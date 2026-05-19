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

async function fplFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VidiGoals/1.0)' },
  });
  if (!res.ok) throw new Error(`FPL API error: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

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
    // Reference points (risers):
    //   Doku: 6.5% own → 100.1%   |  Mitchell: 2.4% → 88.8%
    //   Guehi: 32.8% → 78.2%     |  Haaland: 64.5% → 51.7%
    //   Saka: 13% → 48.2%        |  Lewis-Skelly: 1.9% → 46.5%
    //
    // Reference points (fallers):
    //   Walker-Peters: 0.3% → -100.1%  |  Chalobah: 8.9% → -100%
    //   Palmer: 12.5% → -65.3%         |  Salah: 13.7% → -79.3%
    //
    // Formula: threshold = BASE × (1 + ownership^0.45)
    // This produces a curve where:
    //   - Low ownership (0-5%): threshold ~BASE to ~3×BASE
    //   - Mid ownership (10-30%): threshold ~4-6×BASE
    //   - High ownership (50%+): threshold ~8-10×BASE
    //
    const BASE_FACTOR = 1250;

    function calculateProgress(player) {
      const ownership = parseFloat(player.selected_by_percent) || 0;
      const transfersIn = player.transfers_in_event || 0;
      const transfersOut = player.transfers_out_event || 0;
      const netIn = transfersIn - transfersOut;
      const netOut = transfersOut - transfersIn;
      const alreadyChanged = (player.cost_change_event || 0) !== 0;

      // Threshold scales with ownership using power curve
      const threshold = BASE_FACTOR * (1 + Math.pow(ownership + 0.1, 0.45));

      // Rising progress (net transfers IN)
      let riseProgress = netIn > 0 ? (netIn / threshold) * 100 : 0;

      // Falling progress (net transfers OUT)  
      let fallProgress = netOut > 0 ? (netOut / threshold) * 100 : 0;

      // If player already changed price this GW, their counter has partially reset
      // Reduce progress by ~60% to account for the reset mid-GW
      if (alreadyChanged) {
        riseProgress *= 0.4;
        fallProgress *= 0.4;
      }

      return { riseProgress, fallProgress, threshold, netIn, netOut };
    }

    function estimateChangeTime(progress) {
      if (progress >= 100) return 'Tonight';
      if (progress >= 90) return 'Tonight';
      if (progress >= 70) return '< 2 days';
      if (progress >= 50) return '> 2 days';
      if (progress >= 30) return '> 3 days';
      return '> 4 days';
    }

    // Calculate for all players
    const risers = [];
    const fallers = [];

    for (const player of players) {
      // Skip players with no transfer activity
      const transfersIn = player.transfers_in_event || 0;
      const transfersOut = player.transfers_out_event || 0;
      if (transfersIn === 0 && transfersOut === 0) continue;

      const { riseProgress, fallProgress, netIn, netOut } = calculateProgress(player);
      const team = teamMap[player.team] || {};

      const playerData = {
        id: player.id,
        name: player.web_name,
        fullName: `${player.first_name} ${player.second_name}`,
        position: posMap[player.element_type] || '',
        team: team.name || '',
        teamShort: team.short_name || '',
        ownership: parseFloat(player.selected_by_percent) || 0,
        price: (player.now_cost / 10).toFixed(1),
        priceChange: (player.cost_change_event / 10).toFixed(1),
        priceChangeStart: (player.cost_change_start / 10).toFixed(1),
        transfersIn,
        transfersOut,
        netTransfers: netIn,
        status: player.status, // a=available, i=injured, u=unavailable, s=suspended, d=doubtful
        news: player.news || '',
        chanceOfPlaying: player.chance_of_playing_next_round,
        // Detect potentially locked players
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
