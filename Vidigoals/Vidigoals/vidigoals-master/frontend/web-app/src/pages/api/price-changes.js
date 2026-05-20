/**
 * API Route: /api/price-changes
 *
 * Calculates price change predictions for all FPL players.
 * Uses community-derived formula calibrated against Fantasy Football Fix data.
 *
 * Formula:
 *   threshold = base_factor / (ownership_pct + dampening)
 *   progress = net_transfers / threshold × 100
 *
 * Where:
 *   base_factor ≈ 135 (calibrated to match FFF's progress values)
 *   dampening = 0.6 (prevents division issues at very low ownership)
 *   net_transfers = transfers_in_event - transfers_out_event
 *
 * Returns top risers and fallers sorted by progress.
 */

let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// ── Price tracking store ──────────────────────────────────────────────────────
// Tracks last known price for each player to detect when price actually changes
// When price moves ±0.1, progress resets to 0%
let priceStore = {}; // { playerId: lastKnownPrice }
let resetPlayers = new Set(); // Players whose progress was reset (price changed)

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) throw new Error(`FPL API error: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Rate limiting + origin check
  const { protect } = await import('../../lib/api-protection');
  const blocked = protect(req, res);
  if (blocked) return;

  // Return cached if fresh
  if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return res.status(200).json({ ...cache.data, cached: true });
  }

  try {
    const bootstrap = await fplFetch('https://fantasy.premierleague.com/api/bootstrap-static/');
    const players = bootstrap.elements || [];
    const teams = bootstrap.teams || [];

    const teamMap = {};
    for (const t of teams) {
      teamMap[t.id] = t;
    }

    const posMap = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward' };

    // ── Price change model ────────────────────────────────────────────────
    // Calibrated against Fantasy Football Fix data (May 2026):
    //
    // Key insight: Progress should be 0-100% range for risers, 0 to -100% for fallers.
    // 100% = price change tonight. Progress CAPS at 100%.
    //
    // FFF reference (risers):
    //   Doku: 6.5% own → 100.1%   |  Mitchell: 2.4% → 88.8%
    //   Guehi: 32.8% → 78.2%     |  Truffert: 4.7% → 76.5%
    //   Haaland: 64.5% → 51.7%   |  Saka: 13% → 48.2%
    //
    // FFF reference (fallers):
    //   Walker-Peters: 0.3% → -100.1%  |  Chalobah: 8.9% → -100%
    //   Cucurella: 14.4% → -51.3%      |  Palmer: 12.5% → -65.3%
    //
    // Formula: threshold = BASE × (1 + ownership^0.55)
    // BASE calibrated so Doku (6.5% own, high net transfers) hits ~100%
    const BASE_FACTOR = 65000;

    // ── Seed data from Fantasy Football Fix (GW37, May 19 2026) ───────────
    // These are the starting progress percentages. Our formula only adds/subtracts
    // small deltas from these starting points based on ongoing transfer activity.
    // ── Seed data from Fantasy Football Fix (May 20 2026, ~03:00 UTC) ─────
    // Progress values at time of seeding. The formula adds speed × hours_elapsed.
    const SEED_PROGRESS = {
      // RISERS — Updated May 20 2026 from FFF
      'Doku': 99.7, 'Truffert': 76.5, 'Kroupi.Jr': 62.7,
      'Mateta': 54.0, 'Haaland': 51.8, 'Szoboszlai': 45.9,
      'Rice': 42.9, 'Anderson': 26.7, 'Cherki': 45.2,
      'Virgil': 11.2, 'Enzo': 8.9, 'Richarlison': 2.9,
      'Senesi': 2.1,
      // FALLERS — Updated May 20 2026 from FFF
      'Gibbs-White': -55.6, 'Mavropanos': -15.8, 'Bowen': -28.1,
      'Havertz': -79.7, 'Semenyo': -102.7, 'Casemiro': -6.7,
      'Okafor': -72.0, 'Thiago': -22.8, 'Wilson': -1.2,
      'Gyokeres': -3.8, 'Strand Larsen': -1.3, 'Garner': -2.6,
      'Schade': -11.0, 'J.Palhinha': -27.3,
    };
    const SEED_TIMESTAMP = new Date('2026-05-20T03:00:00Z').getTime();

    function calculateProgress(player) {
      const ownership = parseFloat(player.selected_by_percent) || 0;
      const transfersIn = player.transfers_in_event || 0;
      const transfersOut = player.transfers_out_event || 0;
      const netIn = transfersIn - transfersOut;
      const alreadyChanged = (player.cost_change_event || 0) !== 0;
      const playerName = player.web_name;

      // Threshold: net transfers needed for price change (scales with ownership)
      const threshold = BASE_FACTOR * (1 + Math.pow(ownership + 0.1, 0.55));

      // Speed: how fast progress moves per hour
      // = (net transfers per hour) / threshold × 100
      // Use 24hr window as approximation of current rate
      const hoursInGW = 24;
      const netPerHour = netIn / hoursInGW;
      const rawSpeed = (netPerHour / threshold) * 100;
      // Speed value (always positive, direction separate)
      const speed = (transfersIn > 0 || transfersOut > 0) ? Math.min(1.0, Math.round(Math.abs(rawSpeed) * 10) / 10) : 0;
      // Direction: positive net = being bought (up), negative = being sold (down)
      const speedDirection = netIn >= 0 ? 'up' : 'down';

      // If price already changed, reset progress
      if (resetPlayers.has(playerName)) {
        let riseProgress = netIn > 0 ? Math.min(100, (netIn / threshold) * 100) : 0;
        let fallProgress = netIn < 0 ? Math.min(100, (Math.abs(netIn) / threshold) * 100) : 0;
        return { riseProgress, fallProgress, threshold, netIn, netOut: -netIn, speed, speedDirection };
      }

      const seedValue = SEED_PROGRESS[playerName] || null;

      if (seedValue !== null) {
        // Progress = seed + (speed × hours since seed)
        // Speed moves progress toward +100 (if buying) or -100 (if selling)
        const hoursElapsed = Math.max(0, (Date.now() - SEED_TIMESTAMP) / (1000 * 60 * 60));
        const progressDelta = rawSpeed * Math.min(hoursElapsed, 72);
        let progress = seedValue + progressDelta;
        progress = Math.max(-100, Math.min(100, progress));

        const isRising = progress >= 0;
        return {
          riseProgress: isRising ? progress : 0,
          fallProgress: isRising ? 0 : Math.abs(progress),
          threshold, netIn, netOut: -netIn, speed, speedDirection
        };
      }

      // No seed — pure calculation
      let riseProgress = netIn > 0 ? Math.min(100, (netIn / threshold) * 100) : 0;
      let fallProgress = netIn < 0 ? Math.min(100, (Math.abs(netIn) / threshold) * 100) : 0;
      if (alreadyChanged) { riseProgress *= 0.4; fallProgress *= 0.4; }

      return { riseProgress, fallProgress, threshold, netIn, netOut: -netIn, speed, speedDirection };
    }

    function estimateChangeTime(progress) {
      if (progress >= 95) return 'Tonight';
      if (progress >= 80) return 'Tomorrow';
      if (progress >= 60) return '< 2 days';
      if (progress >= 40) return '> 2 days';
      if (progress >= 25) return '> 3 days';
      return '> 4 days';
    }

    // Calculate for all players
    const risers = [];
    const fallers = [];

    // Check for price changes — compare current prices vs stored prices
    for (const player of players) {
      const currentPrice = player.now_cost;
      const storedPrice = priceStore[player.id];
      
      if (storedPrice !== undefined && currentPrice !== storedPrice) {
        // Price has changed! Reset this player's progress
        resetPlayers.add(player.web_name);
      }
      // Update stored price
      priceStore[player.id] = currentPrice;
    }

    for (const player of players) {
      // Skip players with no transfer activity
      const transfersIn = player.transfers_in_event || 0;
      const transfersOut = player.transfers_out_event || 0;
      if (transfersIn === 0 && transfersOut === 0) continue;

      const { riseProgress, fallProgress, netIn, netOut } = calculateProgress(player);
      const team = teamMap[player.team] || {};

      // Calculate speed: transfer rate relative to threshold
      // Speed = how much progress changes per hour based on current transfer velocity
      // Higher transfers relative to threshold = faster speed
      const ownership = parseFloat(player.selected_by_percent) || 0;
      const threshold = BASE_FACTOR * (1 + Math.pow(ownership + 0.1, 0.55));
      const transfersInRate = transfersIn;
      const transfersOutRate = transfersOut;
      // Speed = how fast progress is currently moving (per hour)
      // Use net transfers relative to threshold, assume ~12 hours of activity for more responsive speed
      const hoursActive = 12;
      const netRate = (transfersIn - transfersOut) / hoursActive;
      const rawSpeed = (netRate / threshold) * 100;
      // Round to nearest 0.1, cap at 1.0
      const speed = (transfersIn > 0 || transfersOut > 0) ? Math.min(1.0, Math.max(0.1, Math.round(Math.abs(rawSpeed) * 10) / 10)) : 0;
      // Speed direction: positive = being bought (progress moving toward +), negative = being sold
      const speedDirection = netRate >= 0 ? 'up' : 'down';

      const playerData = {
        id: player.id,
        name: player.web_name,
        fullName: `${player.first_name} ${player.second_name}`,
        position: posMap[player.element_type] || '',
        team: team.name || '',
        teamShort: team.short_name || '',
        teamId: player.team || null,
        ownership: parseFloat(player.selected_by_percent) || 0,
        price: (player.now_cost / 10).toFixed(1),
        priceChange: (player.cost_change_event / 10).toFixed(1),
        priceChangeStart: (player.cost_change_start / 10).toFixed(1),
        transfersIn,
        transfersOut,
        netTransfers: netIn,
        speed, // %/hour based on actual transfer velocity
        speedDirection, // 'up' or 'down' — independent of riser/faller status
        status: player.status,
        news: player.news || '',
        chanceOfPlaying: player.chance_of_playing_next_round,
        locked: player.status === 'u' || (player.news && player.news.toLowerCase().includes('joined')),
      };

      // Include all players with any progress (like FFF shows all 623)
      if (riseProgress > 0) {
        risers.push({
          ...playerData,
          progress: Math.round(riseProgress * 10) / 10,
          changeTime: estimateChangeTime(riseProgress),
          direction: 'rise',
        });
      }

      if (fallProgress > 0) {
        fallers.push({
          ...playerData,
          progress: Math.round(fallProgress * 10) / 10,
          changeTime: estimateChangeTime(fallProgress),
          direction: 'fall',
        });
      }
    }

    // Sort by progress descending
    risers.sort((a, b) => b.progress - a.progress);
    fallers.sort((a, b) => b.progress - a.progress);

    const result = {
      risers,
      fallers,
      lastUpdated: new Date().toISOString(),
      totalPlayers: players.length,
    };

    cache = { data: result, fetchedAt: Date.now() };
    return res.status(200).json({ ...result, cached: false });
  } catch (err) {
    if (cache.data) {
      return res.status(200).json({ ...cache.data, cached: true, stale: true, error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}
