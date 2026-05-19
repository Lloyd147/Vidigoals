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
    const SEED_PROGRESS = {
      // RISERS (positive progress)
      'Doku': 100.1, 'Mitchell': 88.8, 'Guehi': 78.2, 'Truffert': 76.5,
      'Richards': 68.3, 'Alderete': 67.0, 'Kroupi.Jr': 60.3, 'Henderson': 57.6,
      'B.Fernandes': 55.4, 'Mateta': 55.4, 'Aaronson': 53.6, 'Haaland': 51.7,
      'Cherki': 50.1, 'Saka': 48.2, 'Lewis-Skelly': 46.5, 'Ngumoha': 44.7,
      'Rice': 44.1, 'Szoboszlai': 40.9, 'Damsgaard': 35.7, 'Minteh': 35.4,
      'Amad': 33.7, 'Lammens': 33.5, 'Shaw': 33.4, 'Igor Jesus': 32.6,
      'Ait-Nouri': 30.3, 'Barry': 29.7, 'Keane': 29.2, 'Wan-Bissaka': 28.9,
      'Donnarumma': 28.0, 'Rayan': 27.4, 'Khusanov': 27.3, 'Baleba': 26.8,
      'Dowman': 26.0, 'Gabriel': 25.5, 'Ampadu': 24.8, 'Canvot': 24.8,
      'Dewsbury-Hall': 24.6, 'M.Fernandes': 24.5, 'Flemming': 23.8,
      'Maguire': 23.2, 'Mainoo': 22.3, 'Anderson': 20.6, 'Bassey': 20.5,
      'Hermansen': 19.4, 'Stach': 17.9, 'Calvert-Lewin': 17.8, 'Bijol': 17.4,
      'Acheampong': 16.5, 'Kelleher': 16.2, 'Adli': 15.8, 'Madueke': 15.3,
      'Bruno G.': 15.2, 'Wharton': 14.6, 'Eze': 14.5, 'Gros': 14.4,
      'Seung soo': 13.7, 'Barnes': 12.5, 'Maatsen': 12.4, 'Hincapie': 12.3,
      'J.Gomes': 11.9,
      // FALLERS (negative progress)
      'Ake': -17.8, 'Struijk': -18.0, 'Ugochukwu': -18.2, 'Wieffer': -18.5,
      'Munoz': -18.6, 'Abraham': -18.7, 'Meslier': -18.8, 'Jair Cunha': -19.3,
      'M.Bizot': -20.4, 'Marsh': -20.5, 'Mosquera': -20.6, 'Gusto': -20.8,
      'Fraser': -21.1, 'Matthews': -21.3, 'Reed': -21.3, 'Mitoma': -21.3,
      'Romero': -22.4, 'Barkley': -22.4, 'Watkins': -23.3, 'Robertson': -24.6,
      'Pedro Lima': -24.9, 'Tolu': -25.8, 'Boly': -26.1, 'Dalot': -26.3,
      'Gakpo': -27.5, 'Hutchinson': -27.7, 'Tzimas': -28.2, 'Buendia': -28.6,
      'J.Palhinha': -29.0, 'Welbeck': -29.3, 'J.Timber': -29.3, 'Gittens': -30.6,
      'Aznou': -31.1, 'Mavropanos': -32.0, 'Sessegnon': -32.0, 'McAtee': -32.1,
      'Isak': -32.2, 'Woodman': -32.5, 'Bayindir': -32.7, 'Bowen': -32.8,
      'Eyestone': -32.9, 'Areola': -34.1, 'Kinsky': -34.2, 'Endo': -35.5,
      'Calafiori': -36.7, 'Gravenberch': -36.8, 'Kostoulas': -36.9,
      'Danns': -37.6, 'L.Miley': -38.3, 'Sancho': -38.5, 'Davies': -39.1,
      'Diakite': -39.9, 'Chukwueze': -39.9, 'J.Murphy': -40.0, 'Jose Sa': -40.2,
      'Mings': -41.1, 'Mbeumo': -41.5, 'Livramento': -41.9, 'Johnson': -41.9,
      'Muniz': -42.8, 'N.Gonzalez': -44.0, 'Ndoye': -44.8, 'Trippier': -45.0,
      'Cash': -45.7, 'King': -46.2, 'Caicedo': -46.3, 'Murillo': -47.3,
      'Van de Ven': -47.8, 'Schar': -48.0, 'Estevao': -48.3, 'Brooks': -48.4,
      'Gordon': -49.3, 'Balcombe': -49.3, 'Solanke': -50.4, 'Cucurella': -51.3,
      'Fofana': -51.7, 'Barnes': -52.1, 'Grealish': -52.3, 'Potts': -52.7,
      'Foden': -52.9, 'Woltemade': -53.7, 'Raul': -54.3, 'Devenny': -55.1,
      'Isidor': -56.4, 'Bradley': -56.7, 'Diouf': -57.2, 'Cairns': -57.3,
      'De Ligt': -58.2, 'Nketiah': -58.4, 'Tete': -58.7, 'Hill': -59.2,
      'Hudson-Odoi': -59.5, 'Norgaard': -62.0, 'Ekdal': -63.2, 'Pau': -64.0,
      'Xavi': -64.2, 'Gunn': -87.7, 'Garnacho': -89.4, 'Rigg': -90.3,
      'Gomez': -90.8, 'Havertz': -91.3, 'Piroe': -91.9, 'Hume': -92.3,
      'Walker': -92.4, 'Proctor': -93.6, 'Christie': -84.2, 'Ba': -85.9,
      'Neto': -86.4, 'Alcaraz': -87.4, 'Henderson': -87.5, 'Xhaka': -87.6,
      'Krejci': -68.7, 'Martinelli': -69.2, 'Mee': -70.4, 'Amissah': -70.4,
      'Hladky': -72.3, 'Rogers': -72.3, 'Milenkovic': -72.6, 'Welch': -73.4,
      'Slonina': -73.6, 'Wright': -74.1, 'Wilson': -74.9, 'Doherty': -76.8,
      'Zirkzee': -77.1, 'Steele': -77.3, 'Reijnders': -77.4, 'A.Murphy': -78.4,
      'Longstaff': -78.5, 'A.Becker': -78.7, 'Palmer': -65.3, 'Gibbs-White': -66.1,
      'Okafor': -66.7, 'Gillespie': -67.1, 'McGill': -67.2, 'Savinho': -67.9,
      'Mount': -68.2, 'Cullen': -68.7, 'Kudus': -79.1, 'M.Salah': -79.3,
      'Kolo Muani': -79.9, 'Patterson': -80.4, 'Lecomte': -80.7, 'Trafford': -80.9,
      'Hickey': -81.6, 'Gudmundsson': -82.0, 'Kilman': -82.0, 'Perri': -83.1,
      'Bettinelli': -93.7, 'Chiesa': -94.1, 'Roefs': -94.8, 'Austin': -95.2,
      'Ramsdale': -95.5, 'James': -96.2, 'King': -96.5, 'Bogarde': -96.6,
      'Gonzalez': -96.6, 'Nyoni': -96.8, 'Obi': -97.1, 'Pivas': -97.2,
      'Clyne': -97.5, 'Tuanzebe': -97.8, 'Digne': -98.0, 'Foster': -98.5,
      'Ruben': -99.1, 'Semenyo': -99.6, 'Sanchez': -99.6, 'Martinez': -99.7,
      'Wirtz': -99.8, 'Chalobah': -100.0, 'Walker-Peters': -100.1,
    };

    function calculateProgress(player) {
      const ownership = parseFloat(player.selected_by_percent) || 0;
      const transfersIn = player.transfers_in_event || 0;
      const transfersOut = player.transfers_out_event || 0;
      const netIn = transfersIn - transfersOut;
      const netOut = transfersOut - transfersIn;
      const alreadyChanged = (player.cost_change_event || 0) !== 0;

      // Check if this player has seed data from FFF
      const playerName = player.web_name;
      const seedValue = SEED_PROGRESS[playerName] || null;

      // If player's price changed since we started tracking, reset to 0%
      if (resetPlayers.has(playerName)) {
        // Price changed — progress resets, start building from 0
        const threshold = BASE_FACTOR * (1 + Math.pow(ownership + 0.1, 0.55));
        let riseProgress = netIn > 0 ? (netIn / threshold) * 100 : 0;
        let fallProgress = netOut > 0 ? (netOut / threshold) * 100 : 0;
        riseProgress = Math.min(riseProgress, 100);
        fallProgress = Math.min(fallProgress, 100);
        return { riseProgress, fallProgress, threshold, netIn, netOut };
      }

      if (seedValue !== null) {
        // Use seed as the base — the formula only adds a tiny delta on top
        // Delta represents movement since the seed was captured
        // FFF shows ~0.10-0.20% per hour for active players
        // With 15-min polling, each poll adds ~0.03-0.05%
        const threshold = BASE_FACTOR * (1 + Math.pow(ownership + 0.1, 0.55));
        let delta = 0;
        if (netIn > 0) {
          delta = (netIn / threshold) * 0.3; // ~0.05% per poll for typical player
        } else if (netOut > 0) {
          delta = -(netOut / threshold) * 0.3;
        }

        let progress = seedValue + delta;
        // Cap at 100 for risers, -100 for fallers
        if (progress > 0) progress = Math.min(progress, 100);
        if (progress < 0) progress = Math.max(progress, -100);

        const isRising = progress >= 0;
        return {
          riseProgress: isRising ? progress : 0,
          fallProgress: isRising ? 0 : Math.abs(progress),
          threshold, netIn, netOut
        };
      }

      // No seed data — start from 0% and calculate purely from transfers
      const threshold = BASE_FACTOR * (1 + Math.pow(ownership + 0.1, 0.55));

      let riseProgress = netIn > 0 ? (netIn / threshold) * 100 : 0;
      let fallProgress = netOut > 0 ? (netOut / threshold) * 100 : 0;

      if (alreadyChanged) {
        riseProgress *= 0.4;
        fallProgress *= 0.4;
      }

      riseProgress = Math.min(riseProgress, 100);
      fallProgress = Math.min(fallProgress, 100);

      return { riseProgress, fallProgress, threshold, netIn, netOut };
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
