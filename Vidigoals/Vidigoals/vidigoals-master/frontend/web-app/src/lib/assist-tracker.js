/**
 * Assist Reconciliation System
 *
 * Tracks goals during live matches and reconciles assists between
 * API-Football (immediate) and FPL (delayed but authoritative).
 *
 * Uses Upstash Redis for persistent state across serverless invocations.
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const WATCH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const KEY_PREFIX = 'assist:';

/**
 * Record a new goal detected from API-Football.
 * Stores the initial assist info and starts the watch window.
 */
export async function recordGoal({ fixtureId, goalIndex, player, apiAssist, fplAssistCountAtGoal, timestamp }) {
  const key = `${KEY_PREFIX}${fixtureId}:goal:${goalIndex}`;
  const data = {
    fixtureId,
    goalIndex,
    player,
    apiAssist,              // API-Football's assist (may be null)
    confirmedAssist: null,  // Will be set after FPL confirms
    fplAssistCountAtGoal,   // How many FPL assists existed when this goal was scored
    status: 'watching',     // watching | confirmed | no_assist
    createdAt: timestamp || Date.now(),
    watchUntil: (timestamp || Date.now()) + WATCH_WINDOW_MS,
  };

  await redis.set(key, JSON.stringify(data), { ex: 3600 }); // Expire after 1 hour
  return data;
}

/**
 * Get all goals currently being watched for a fixture.
 */
export async function getWatchingGoals(fixtureId) {
  const pattern = `${KEY_PREFIX}${fixtureId}:goal:*`;
  const keys = await redis.keys(pattern);
  if (!keys || keys.length === 0) return [];

  const goals = [];
  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      goals.push(parsed);
    }
  }
  return goals;
}

/**
 * Reconcile assists for a fixture based on current FPL data.
 *
 * @param fixtureId - The API-Football fixture ID
 * @param fplAssists - Array of assist player names from FPL for this fixture (in order added)
 * @param fplAssistCount - Total number of assists FPL has awarded
 */
export async function reconcileAssists(fixtureId, fplAssists, fplAssistCount) {
  const goals = await getWatchingGoals(fixtureId);
  if (goals.length === 0) return [];

  const now = Date.now();
  const updates = [];

  // Sort goals by goalIndex to process in order
  goals.sort((a, b) => a.goalIndex - b.goalIndex);

  for (const goal of goals) {
    if (goal.status !== 'watching') continue;

    const key = `${KEY_PREFIX}${fixtureId}:goal:${goal.goalIndex}`;

    // The expected FPL assist index for this goal
    const expectedFplIndex = goal.fplAssistCountAtGoal;

    // Check if FPL has added a new assist since this goal was scored
    if (fplAssistCount > expectedFplIndex) {
      // FPL has added at least one new assist
      const newAssistPlayer = fplAssists[expectedFplIndex] || null;

      if (newAssistPlayer) {
        // FPL confirmed an assist
        goal.confirmedAssist = newAssistPlayer;
        goal.status = 'confirmed';
        updates.push({
          goalIndex: goal.goalIndex,
          action: 'confirmed',
          player: goal.player,
          assist: newAssistPlayer,
          previousAssist: goal.apiAssist,
          changed: goal.apiAssist !== newAssistPlayer,
        });
      }
    } else if (now > goal.watchUntil) {
      // Watch window expired — FPL didn't add an assist for this goal
      goal.confirmedAssist = null;
      goal.status = 'no_assist';
      updates.push({
        goalIndex: goal.goalIndex,
        action: 'no_assist',
        player: goal.player,
        previousAssist: goal.apiAssist,
      });
    }
    // else: still watching, no change yet

    // Save updated state
    await redis.set(key, JSON.stringify(goal), { ex: 3600 });
  }

  return updates;
}

/**
 * Get the confirmed assist for a specific goal.
 * Returns: { assist, status } where status is 'watching' | 'confirmed' | 'no_assist'
 */
export async function getGoalAssist(fixtureId, goalIndex) {
  const key = `${KEY_PREFIX}${fixtureId}:goal:${goalIndex}`;
  const data = await redis.get(key);
  if (!data) return null;

  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  return {
    assist: parsed.status === 'confirmed' ? parsed.confirmedAssist :
            parsed.status === 'no_assist' ? null :
            parsed.apiAssist, // Still watching — show API-Football's version
    status: parsed.status,
    apiAssist: parsed.apiAssist,
    confirmedAssist: parsed.confirmedAssist,
  };
}

/**
 * Get all confirmed/watching assists for a fixture.
 * Used by the feed to display the correct assist for each goal.
 */
export async function getFixtureAssists(fixtureId) {
  const goals = await getWatchingGoals(fixtureId);
  const assistMap = {};

  for (const goal of goals) {
    const assist = goal.status === 'confirmed' ? goal.confirmedAssist :
                   goal.status === 'no_assist' ? null :
                   goal.apiAssist;
    assistMap[goal.goalIndex] = {
      assist,
      status: goal.status,
    };
  }

  return assistMap;
}

/**
 * Mark all watching goals as confirmed when match ends.
 * Uses final FPL data as the source of truth.
 */
export async function finalizeFixture(fixtureId, fplAssists) {
  const goals = await getWatchingGoals(fixtureId);

  for (const goal of goals) {
    if (goal.status === 'watching') {
      const key = `${KEY_PREFIX}${fixtureId}:goal:${goal.goalIndex}`;
      const expectedIndex = goal.fplAssistCountAtGoal;

      if (fplAssists[expectedIndex]) {
        goal.confirmedAssist = fplAssists[expectedIndex];
        goal.status = 'confirmed';
      } else {
        goal.confirmedAssist = null;
        goal.status = 'no_assist';
      }

      await redis.set(key, JSON.stringify(goal), { ex: 86400 }); // Keep for 24h after match
    }
  }
}
