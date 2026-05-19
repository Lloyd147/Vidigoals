/**
 * PlayerOddsView — Reusable Player Odds tab component
 * Shows odds for all players in a team with market dropdown, bookie logos, Scored/No Goal text.
 *
 * Props:
 *  - picks: { starting: [...], bench: [...] }
 *  - gw: current gameweek number
 *  - odds: odds data object from /api/livescore-odds (or null)
 */
import { useState, useEffect } from 'react';
import { ShirtSVG } from './TeamPitchView';

// Bookie logo mapping
function getBookieLogo(bookie) {
  const name = (bookie || '').toLowerCase().replace(/\s+/g, '');
  const logoMap = {
    'livescorebet': '/logos/livescorebet', 'livescore': '/logos/livescorebet',
    'bet365': '/logos/bet365', '1xbet': '/logos/1xbet', 'betfair': '/logos/betfair',
  };
  let base = logoMap[name];
  if (!base) {
    for (const [key, url] of Object.entries(logoMap)) {
      if (name.includes(key) || key.includes(name)) { base = url; break; }
    }
  }
  return base ? `${base}.png` : '';
}

export default function PlayerOddsView({ picks, gw, odds: externalOdds }) {
  const [odds, setOdds] = useState(externalOdds || null);
  const [selectedMarket, setSelectedMarket] = useState('anytime');
  const [marketOpen, setMarketOpen] = useState(false);

  // Fetch odds if not provided externally
  useEffect(() => {
    if (!odds) {
      fetch('/api/livescore-odds')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.odds) setOdds(data.odds); })
        .catch(() => {});
    }
  }, []);

  // Update if external odds change
  useEffect(() => { if (externalOdds) setOdds(externalOdds); }, [externalOdds]);

  const marketLabel = { anytime: 'To Score Anytime', firstGoal: 'First Goalscorer', twoPlus: '2 or More Goals', hatTrick: 'Hat-trick', assists: 'To Get Assist', yellowCard: 'Yellow Card', redCard: 'Red Card' }[selectedMarket] || 'To Score Anytime';

  const allPlayers = [...(picks?.starting || []), ...(picks?.bench || [])];

  return (
    <div style={{ padding: '0.5rem 0', paddingBottom: '20px' }}>
      {/* Header banner with market switcher */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0.5rem', background: '#f5a623', color: '#1a0a2e', fontWeight: 700, fontSize: '0.7rem' }}>
        <span style={{ width: '28px', textAlign: 'center' }}>Pos</span>
        <span style={{ flex: 1 }}>Player</span>
        <span style={{ width: '65px', textAlign: 'center' }}>GW{gw}</span>
        <div style={{ width: '160px', position: 'relative' }}>
          <button onClick={() => setMarketOpen(m => !m)} style={{ background: 'transparent', border: 'none', color: '#1a0a2e', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
            {marketLabel} {marketOpen ? '▲' : '▼'}
          </button>
          {marketOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, background: '#2d0a5e', border: '1px solid #4a1a8e', borderRadius: '4px', zIndex: 50, minWidth: '200px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              {[
                { key: 'anytime', label: 'To Score Anytime' },
                { key: 'firstGoal', label: 'First Goalscorer' },
                { key: 'twoPlus', label: '2 or More Goals' },
                { key: 'hatTrick', label: 'Hat-trick' },
                { key: 'assists', label: 'To Get Assist' },
                { key: 'yellowCard', label: 'Yellow Card' },
                { key: 'redCard', label: 'Red Card' },
              ].map(m => (
                <button key={m.key} onClick={() => { setSelectedMarket(m.key); setMarketOpen(false); }} style={{ display: 'block', width: '100%', background: selectedMarket === m.key ? 'rgba(245,166,35,0.15)' : 'transparent', border: 'none', color: selectedMarket === m.key ? '#f5a623' : '#ccc', fontSize: '0.78rem', padding: '0.6rem 0.8rem', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #4a1a8e' }}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Player rows */}
      {allPlayers.map(player => {
        const posLabels = { 1: 'GK', 2: 'D', 3: 'M', 4: 'F' };
        const posColors = { 1: '#f5a623', 2: '#48bb78', 3: '#63b3ed', 4: '#fc8181' };

        // Match player to odds
        let playerOdds = null;
        if (odds) {
          const webName = (player.web_name || '').toLowerCase();
          const fullName = (player.name || '').toLowerCase();
          const lastName = fullName.split(' ').pop() || '';
          const match = Object.values(odds).find(o => {
            const oddsName = (o.name || '').toLowerCase();
            const oddsLast = oddsName.split(' ').pop() || '';
            return oddsName === fullName || oddsName.includes(webName) || webName.includes(oddsLast) || oddsLast === lastName;
          });
          if (match && player.fixture) {
            const oddsFixture = (match.fixture || '').toLowerCase();
            const playerTeam = (player.team_name || '').toLowerCase();
            const playerShort = (player.team_short || '').toLowerCase();
            const teamVariants = [playerTeam, playerShort];
            if (playerTeam === 'spurs') teamVariants.push('tottenham');
            if (playerTeam === 'wolves') teamVariants.push('wolverhampton');
            if (playerTeam.includes('man city')) teamVariants.push('manchester city');
            if (playerTeam.includes('man utd')) teamVariants.push('manchester united');
            if (playerTeam.includes("nott'm forest")) teamVariants.push('nottingham forest');
            const fixtureMatches = teamVariants.some(v => oddsFixture.includes(v));
            if (fixtureMatches) playerOdds = match;
          }
        }

        const marketOdds = playerOdds?.[selectedMarket] || null;

        return (
          <div key={player.element} style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 0.5rem', borderBottom: '1px solid #2d1a4e' }}>
            <span style={{ width: '28px', textAlign: 'center', color: posColors[player.element_type] || '#ccc', fontWeight: 700, fontSize: '0.72rem' }}>{posLabels[player.element_type]}</span>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <ShirtSVG teamId={player.team_id} isGkp={player.element_type === 1} size={32} playerId={player.element} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#eaeaea', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player.web_name}</div>
                <div style={{ color: '#8892b0', fontSize: '0.6rem' }}>{player.team_name}</div>
              </div>
            </div>
            <span style={{ width: '65px', textAlign: 'center', color: '#8892b0', fontSize: '0.68rem', flexShrink: 0 }}>{player.fixture || '—'}</span>
            <div style={{ width: '160px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
              {player.fixtureFinished ? (
                <span style={{ color: (() => {
                  if (selectedMarket === 'anytime' || selectedMarket === 'firstGoal' || selectedMarket === 'twoPlus' || selectedMarket === 'hatTrick') return player.goalsScored > 0 ? '#48bb78' : '#8892b0';
                  if (selectedMarket === 'yellowCard') return player.yellowCards > 0 ? '#f5a623' : '#8892b0';
                  if (selectedMarket === 'redCard') return player.redCards > 0 ? '#fc8181' : '#8892b0';
                  if (selectedMarket === 'assists') return player.assistsMade > 0 ? '#48bb78' : '#8892b0';
                  return '#8892b0';
                })(), fontWeight: 700, fontSize: '0.8rem' }}>
                  {(() => {
                    if (selectedMarket === 'anytime' || selectedMarket === 'firstGoal') return player.goalsScored > 0 ? 'Scored' : 'No Goal';
                    if (selectedMarket === 'twoPlus') return player.goalsScored >= 2 ? `Scored ${player.goalsScored}` : 'No';
                    if (selectedMarket === 'hatTrick') return player.goalsScored >= 3 ? 'Hat-trick!' : 'No';
                    if (selectedMarket === 'yellowCard') return player.yellowCards > 0 ? 'Yellow Card' : 'No Card';
                    if (selectedMarket === 'redCard') return player.redCards > 0 ? 'Red Card' : 'No Card';
                    if (selectedMarket === 'assists') return player.assistsMade > 0 ? `Assist (${player.assistsMade})` : 'No Assist';
                    return '—';
                  })()}
                </span>
              ) : marketOdds ? (
                <a href={playerOdds?.eventUrl || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', textDecoration: 'none', cursor: 'pointer', width: '100%' }}>
                  <span style={{ color: '#f5a623', fontWeight: 700, fontSize: '0.95rem' }}>{marketOdds.odds}</span>
                  <div style={{ width: '80px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src={getBookieLogo(marketOdds.bookie)} alt={marketOdds.bookie} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '3px' }} onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                </a>
              ) : (
                <span style={{ color: '#8892b0' }}>—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
