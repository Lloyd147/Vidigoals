/**
 * TeamPitchView — Reusable pitch view component showing a team's players
 * with SVG shirts, formation layout, points, fixtures, and captain badges.
 *
 * Used by: my-team.js (own team) and leaderboard.js (viewing other players' teams)
 *
 * Props:
 *  - picks: { starting: [...], bench: [...], entry_history: {...}, active_chip: string }
 *  - gw: current gameweek number
 *  - onPlayerClick: (player) => void (optional, for popup)
 */
import styled, { css } from 'styled-components';

// ── Team shirt colour map (by FPL team_id) ────────────────────────────────────
const TEAM_COLOURS = {
  1:  { primary: '#EF0107', secondary: '#ffffff', pattern: 'solid' },
  2:  { primary: '#670E36', secondary: '#95BFE5', pattern: 'solid' },
  3:  { primary: '#670E36', secondary: '#95BFE5', pattern: 'solid' },
  4:  { primary: '#8B0000', secondary: '#000000', pattern: 'stripes' },
  5:  { primary: '#E30613', secondary: '#ffffff', pattern: 'stripes' },
  6:  { primary: '#0057B8', secondary: '#ffffff', pattern: 'stripes' },
  7:  { primary: '#034694', secondary: '#034694', pattern: 'solid' },
  8:  { primary: '#1B458F', secondary: '#C4122E', pattern: 'stripes' },
  9:  { primary: '#003399', secondary: '#003399', pattern: 'solid' },
  10: { primary: '#ffffff', secondary: '#000000', pattern: 'solid' },
  11: { primary: '#ffffff', secondary: '#ffffff', pattern: 'solid' },
  12: { primary: '#C8102E', secondary: '#C8102E', pattern: 'solid' },
  13: { primary: '#6CABDD', secondary: '#6CABDD', pattern: 'solid' },
  14: { primary: '#DA291C', secondary: '#DA291C', pattern: 'solid' },
  15: { primary: '#241F20', secondary: '#ffffff', pattern: 'stripes' },
  16: { primary: '#E53233', secondary: '#ffffff', pattern: 'stripes' },
  17: { primary: '#8B0000', secondary: '#ffffff', pattern: 'stripes' },
  18: { primary: '#ffffff', secondary: '#132257', pattern: 'solid' },
  19: { primary: '#7A263A', secondary: '#1BB1E7', pattern: 'solid' },
  20: { primary: '#FDB913', secondary: '#FDB913', pattern: 'solid' },
};

export function ShirtSVG({ teamId, isGkp, isCaptain, isVice, size = 52, playerId }) {
  const { primary, secondary, pattern } = TEAM_COLOURS[teamId] || { primary: '#1a3a6e', secondary: '#ffffff', pattern: 'solid' };
  const stripes = [];
  if (pattern === 'stripes') {
    for (let x = 0; x < 52; x += 6) {
      stripes.push(<rect key={`s-${x}`} x={x} y="0" width="3" height="58" fill={secondary} />);
    }
  }
  const uid = `${teamId}-${playerId || 0}`;
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 52 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`cb-${uid}`}><path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" /></clipPath>
        <clipPath id={`cls-${uid}`}><path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" /></clipPath>
        <clipPath id={`crs-${uid}`}><path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" /></clipPath>
      </defs>
      <path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" fill={pattern === 'stripes' ? primary : secondary} />
      <path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" fill={pattern === 'stripes' ? primary : secondary} />
      <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" fill={primary} />
      <g clipPath={`url(#cls-${uid})`}><rect x="0" y="0" width="52" height="58" fill={pattern === 'stripes' ? primary : secondary} />{pattern === 'stripes' && stripes}</g>
      <g clipPath={`url(#crs-${uid})`}><rect x="0" y="0" width="52" height="58" fill={pattern === 'stripes' ? primary : secondary} />{pattern === 'stripes' && stripes}</g>
      <g clipPath={`url(#cb-${uid})`}><rect x="0" y="0" width="52" height="58" fill={primary} />{pattern === 'stripes' && stripes}</g>
      <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <path d="M18 2 C20 5 23 7 26 7 C29 7 32 5 34 2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2"/>
      {isCaptain && (<><circle cx="46" cy="5" r="10" fill="#f5a623" stroke="#fff" strokeWidth="1.5"/><text x="46" y="10" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1a0a2e">C</text></>)}
      {isVice && (<><circle cx="46" cy="5" r="10" fill="#9b59b6" stroke="#fff" strokeWidth="1.5"/><text x="46" y="10" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff">V</text></>)}
    </svg>
  );
}

// ── Styled components for pitch ───────────────────────────────────────────────
const Pitch = styled.div`
  background: linear-gradient(180deg,
    #2d8a30 0%, #34963a 8%, #2d8a30 16%, #34963a 24%, #2d8a30 32%, #34963a 40%,
    #2d8a30 48%, #34963a 56%, #2d8a30 64%, #34963a 72%, #2d8a30 80%, #34963a 88%, #2d8a30 100%);
  border-radius: 10px;
  padding: 0 0.25rem 1rem;
  position: relative;
  overflow: hidden;
`;

const PitchRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
`;

const PlayerCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 68px;
  cursor: ${({ clickable }) => clickable ? 'pointer' : 'default'};
`;

const PlayerInfoBox = styled.div`
  width: 64px;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 2px;
`;

const PlayerNameLabel = styled.div`
  font-size: 0.58rem;
  font-weight: 700;
  color: #333;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: #fff;
  padding: 2px 2px 1px;
`;

const PlayerFixtureLabel = styled.div`
  font-size: 0.52rem;
  color: #666;
  text-align: center;
  background: #e8e8e8;
  padding: 1px 2px;
`;

const PointsBadge = styled.div`
  font-size: 0.62rem;
  font-weight: 700;
  color: #fff;
  background: ${({ live, hasPoints }) => live ? '#48bb78' : hasPoints ? '#6c2eb9' : '#1a0a2e'};
  text-align: center;
  padding: 2px 4px;
  width: 100%;
`;

const BenchSection = styled.div`
  background: #1a5e2a;
  border-radius: 8px;
  padding: 0.5rem 0.25rem;
  margin-top: 0.75rem;
`;

const BenchLabel = styled.div`
  text-align: center;
  font-size: 0.6rem;
  color: rgba(255,255,255,0.6);
  font-weight: 700;
  margin-bottom: 2px;
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupByPosition(players) {
  return [1, 2, 3, 4].map(type => players.filter(p => p.element_type === type));
}

function PlayerTile({ player, onPlayerClick }) {
  const pts = player.multiplier > 1
    ? player.event_points * player.multiplier
    : player.event_points;

  return (
    <PlayerCard clickable={!!onPlayerClick} onClick={() => onPlayerClick && onPlayerClick(player)}>
      <ShirtSVG
        teamId={player.team_id}
        isGkp={player.element_type === 1}
        isCaptain={player.is_captain}
        isVice={player.is_vice_captain}
        size={44}
        playerId={player.element}
      />
      <PlayerInfoBox>
        <PlayerNameLabel>{player.web_name}</PlayerNameLabel>
        {player.fixtureLive ? (
          <PlayerFixtureLabel style={{ color: '#48bb78', fontWeight: 700, fontSize: '0.5rem' }}>
            {player.fixture} • LIVE {player.fixtureMinutes ? `${player.fixtureMinutes}'` : ''}
          </PlayerFixtureLabel>
        ) : player.fixture ? (
          <PlayerFixtureLabel>{player.fixture}</PlayerFixtureLabel>
        ) : null}
        <PointsBadge hasPoints={pts > 0} live={player.fixtureLive}>{pts}</PointsBadge>
      </PlayerInfoBox>
    </PlayerCard>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TeamPitchView({ picks, gw, onPlayerClick }) {
  if (!picks || !picks.starting) return null;

  const rows = groupByPosition(picks.starting);
  const bench = picks.bench || [];

  return (
    <div style={{ padding: '0.5rem' }}>
      <Pitch>
        {/* VidiGoals banners */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem', marginBottom: '0.25rem' }}>
          <div style={{ background: '#6c2eb9', padding: '0.3rem 0.6rem', fontSize: '0.6rem', fontWeight: 800, color: '#fff', borderRadius: '4px' }}>⚽ Vidi<span style={{ color: '#f5a623' }}>Goals</span></div>
          <div style={{ background: '#2d0a5e', padding: '0.3rem 0.6rem', fontSize: '0.6rem', fontWeight: 800, color: '#fff', borderRadius: '4px' }}>⚽ Vidi<span style={{ color: '#f5a623' }}>Goals</span></div>
        </div>

        {/* Pitch markings */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80px', height: '80px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '3%', right: '3%', height: '1.5px', background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Goal area */}
        <div style={{ position: 'absolute', top: '28px', left: '50%', transform: 'translateX(-50%)', width: '100px', height: '40px', border: '1.5px solid rgba(255,255,255,0.25)', borderTop: 'none', borderRadius: '0 0 4px 4px', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', width: '50px', height: '20px', border: '1.5px solid rgba(255,255,255,0.3)', borderTop: '2px solid rgba(255,255,255,0.4)', borderRadius: '2px 2px 0 0' }} />
        </div>

        {/* Player rows by position */}
        {rows.map((row, i) => (
          <PitchRow key={i}>
            {row.map(player => (
              <PlayerTile key={player.element} player={player} onPlayerClick={onPlayerClick} />
            ))}
          </PitchRow>
        ))}
      </Pitch>

      {/* Bench — only show if there are bench players */}
      {bench.length > 0 && (
        <BenchSection>
          <BenchLabel>YOUR BENCH</BenchLabel>
          <PitchRow>
            {bench.map(player => (
              <PlayerTile key={player.element} player={player} onPlayerClick={onPlayerClick} />
            ))}
          </PitchRow>
        </BenchSection>
      )}
    </div>
  );
}
