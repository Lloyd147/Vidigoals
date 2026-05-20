/**
 * API Route: /api/projections
 *
 * Returns the projected best XI for the next GW.
 * Currently hardcoded for GW38 — model will be enabled once tuned.
 * Same result for every user.
 */

const GW38_BEST_XI = {
  gameweek: 38,
  totalProjected: 53.9,
  starting: [
    { id: 1, name: 'Hermansen', position: 1, posLabel: 'GKP', team: 'Leicester', teamShort: 'LEI', teamId: 8, fixture: 'LEE (H)', difficulty: 2, projectedPoints: 4.9, seasonAvg: 4.2 },
    { id: 2, name: "O'Reilly", position: 2, posLabel: 'DEF', team: 'Man City', teamShort: 'MCI', teamId: 13, fixture: 'AVL (H)', difficulty: 3, projectedPoints: 4.5, seasonAvg: 4.2 },
    { id: 3, name: 'Van Dijk', position: 2, posLabel: 'DEF', team: 'Liverpool', teamShort: 'LIV', teamId: 12, fixture: 'BRI (A)', difficulty: 3, projectedPoints: 4.8, seasonAvg: 4.6 },
    { id: 4, name: 'Porro', position: 2, posLabel: 'DEF', team: 'Spurs', teamShort: 'TOT', teamId: 18, fixture: 'EVE (H)', difficulty: 2, projectedPoints: 5.0, seasonAvg: 4.5 },
    { id: 5, name: 'Gibbs-White', position: 3, posLabel: 'MID', team: "Nott'm Forest", teamShort: 'NFO', teamId: 16, fixture: 'BUR (A)', difficulty: 2, projectedPoints: 5.2, seasonAvg: 4.8 },
    { id: 6, name: 'Semenyo', position: 3, posLabel: 'MID', team: 'Bournemouth', teamShort: 'BOU', teamId: 4, fixture: 'MCI (H)', difficulty: 5, projectedPoints: 4.2, seasonAvg: 4.5 },
    { id: 7, name: 'Szoboszlai', position: 3, posLabel: 'MID', team: 'Liverpool', teamShort: 'LIV', teamId: 12, fixture: 'BRI (A)', difficulty: 3, projectedPoints: 5.0, seasonAvg: 4.7 },
    { id: 8, name: 'B.Fernandes', position: 3, posLabel: 'MID', team: 'Man Utd', teamShort: 'MUN', teamId: 14, fixture: 'BHA (A)', difficulty: 3, projectedPoints: 5.8, seasonAvg: 5.4 },
    { id: 9, name: 'Bowen', position: 4, posLabel: 'FWD', team: 'West Ham', teamShort: 'WHU', teamId: 19, fixture: 'BRI (H)', difficulty: 3, projectedPoints: 4.8, seasonAvg: 4.5 },
    { id: 10, name: 'Osula', position: 4, posLabel: 'FWD', team: 'Newcastle', teamShort: 'NEW', teamId: 15, fixture: 'EVE (A)', difficulty: 2, projectedPoints: 4.5, seasonAvg: 4.0 },
    { id: 11, name: 'Haaland', position: 4, posLabel: 'FWD', team: 'Man City', teamShort: 'MCI', teamId: 13, fixture: 'AVL (H)', difficulty: 3, projectedPoints: 5.2, seasonAvg: 4.9 },
  ],
};

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  return res.status(200).json(GW38_BEST_XI);
}
