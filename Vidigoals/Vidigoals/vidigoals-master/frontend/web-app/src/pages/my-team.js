import { useState, useEffect } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle, css } from 'styled-components';
import AppShell from '../components/AppShell';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a0a2e;
    color: #eaeaea;
    min-height: 100vh;
  }
`;

// ── Team shirt colour map (by FPL team_id) ────────────────────────────────────
// Colours only — no logos. Pattern: solid | stripes | hoops | halves
const TEAM_COLOURS = {
  1:  { primary: '#ef0107', secondary: '#ffffff', pattern: 'stripes' },   // Arsenal
  2:  { primary: '#95bfe5', secondary: '#ffffff', pattern: 'solid' },     // Aston Villa (claret/blue - using away)
  3:  { primary: '#d71920', secondary: '#ffffff', pattern: 'stripes' },   // Bournemouth
  4:  { primary: '#e30613', secondary: '#ffffff', pattern: 'stripes' },   // Brentford
  5:  { primary: '#0057b8', secondary: '#ffffff', pattern: 'stripes' },   // Brighton
  6:  { primary: '#034694', secondary: '#ffffff', pattern: 'solid' },     // Chelsea
  7:  { primary: '#1b458f', secondary: '#c8102e', pattern: 'halves' },    // Crystal Palace
  8:  { primary: '#003399', secondary: '#ffffff', pattern: 'solid' },     // Everton
  9:  { primary: '#ffffff', secondary: '#000000', pattern: 'stripes' },   // Fulham
  10: { primary: '#003090', secondary: '#ffffff', pattern: 'solid' },     // Ipswich
  11: { primary: '#0057a8', secondary: '#ffffff', pattern: 'solid' },     // Leicester
  12: { primary: '#c8102e', secondary: '#ffffff', pattern: 'solid' },     // Liverpool
  13: { primary: '#6cabdd', secondary: '#ffffff', pattern: 'solid' },     // Man City
  14: { primary: '#da291c', secondary: '#000000', pattern: 'solid' },     // Man Utd
  15: { primary: '#241f20', secondary: '#ffffff', pattern: 'stripes' },   // Newcastle
  16: { primary: '#d71920', secondary: '#ffffff', pattern: 'solid' },     // Nottm Forest
  17: { primary: '#132257', secondary: '#ffffff', pattern: 'solid' },     // Southampton
  18: { primary: '#001c58', secondary: '#ffffff', pattern: 'solid' },     // Spurs
  19: { primary: '#7a263a', secondary: '#ffffff', pattern: 'solid' },     // West Ham
  20: { primary: '#fdbe11', secondary: '#231f20', pattern: 'solid' },     // Wolves
};

const GKP_COLOURS = { primary: '#f5a623', secondary: '#1a0a2e', pattern: 'solid' };
const DEFAULT_COLOURS = { primary: '#1a3a6e', secondary: '#ffffff', pattern: 'solid' };

function getShirtColours(teamId, isGkp) {
  if (isGkp) return GKP_COLOURS;
  return TEAM_COLOURS[teamId] || DEFAULT_COLOURS;
}

// ── Shirt SVG component ───────────────────────────────────────────────────────
function ShirtSVG({ teamId, isGkp, isCaptain, isVice, size = 52 }) {
  const { primary, secondary, pattern } = getShirtColours(teamId, isGkp);

  const stripeCount = 5;
  const stripeW = size / stripeCount;

  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 52 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`shirt-clip-${teamId}-${isGkp}`}>
          {/* Shirt shape path */}
          <path d="M14 2 L2 14 L10 18 L10 54 L42 54 L42 18 L50 14 L38 2 C36 8 28 10 26 10 C24 10 16 8 14 2Z" />
        </clipPath>
        {pattern === 'stripes' && (
          <pattern id={`stripes-${teamId}-${isGkp}`} x="0" y="0" width={stripeW * 2} height="58" patternUnits="userSpaceOnUse">
            <rect width={stripeW} height="58" fill={primary} />
            <rect x={stripeW} width={stripeW} height="58" fill={secondary} />
          </pattern>
        )}
        {pattern === 'hoops' && (
          <pattern id={`hoops-${teamId}-${isGkp}`} x="0" y="0" width="52" height="10" patternUnits="userSpaceOnUse">
            <rect width="52" height="5" fill={primary} />
            <rect y="5" width="52" height="5" fill={secondary} />
          </pattern>
        )}
      </defs>

      {/* Shirt body */}
      <path
        d="M14 2 L2 14 L10 18 L10 54 L42 54 L42 18 L50 14 L38 2 C36 8 28 10 26 10 C24 10 16 8 14 2Z"
        fill={
          pattern === 'stripes' ? `url(#stripes-${teamId}-${isGkp})` :
          pattern === 'hoops'   ? `url(#hoops-${teamId}-${isGkp})` :
          pattern === 'halves'  ? primary : primary
        }
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.5"
      />

      {/* Right half for halves pattern */}
      {pattern === 'halves' && (
        <path
          d="M26 10 L38 2 C36 8 28 10 26 10Z M26 10 L42 18 L42 54 L26 54Z"
          fill={secondary}
          clipPath={`url(#shirt-clip-${teamId}-${isGkp})`}
        />
      )}

      {/* Collar */}
      <path
        d="M20 2 C22 6 24 8 26 8 C28 8 30 6 32 2"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.5"
      />

      {/* Sleeves shading */}
      <path d="M2 14 L10 18 L10 28 L2 22Z" fill="rgba(0,0,0,0.15)" />
      <path d="M50 14 L42 18 L42 28 L50 22Z" fill="rgba(0,0,0,0.15)" />

      {/* Captain / Vice badge */}
      {isCaptain && (
        <>
          <circle cx="42" cy="8" r="7" fill="#f5a623" />
          <text x="42" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a0a2e">C</text>
        </>
      )}
      {isVice && (
        <>
          <circle cx="42" cy="8" r="7" fill="#9b59b6" />
          <text x="42" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">V</text>
        </>
      )}
    </svg>
  );
}

// ── Styled components ─────────────────────────────────────────────────────────
const Wrapper = styled.div`
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a0a2e;
`;

const GWHeader = styled.div`
  background: #2d0a5e;
  padding: 0.85rem 1rem 1rem;
  border-bottom: 1px solid #4a1a8e;
`;

const GWNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 0.85rem;
`;

const GWBtn = styled.button`
  background: transparent;
  border: none;
  color: ${({ disabled }) => disabled ? '#4a1a8e' : '#8892b0'};
  font-size: 1.5rem;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  line-height: 1;
  padding: 0 0.25rem;
  transition: color 0.15s;
  &:hover:not(:disabled) { color: #fff; }
`;

const GWLabel = styled.div`
  font-weight: 700;
  font-size: 1.05rem;
  color: #fff;
  min-width: 140px;
  text-align: center;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const StatBox = styled.div`
  flex: 1;
  text-align: center;
  background: rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 0.65rem 0.25rem 0.5rem;
`;

const StatValue = styled.div`
  font-size: ${({ large }) => large ? '1.5rem' : '1rem'};
  font-weight: 800;
  color: ${({ large }) => large ? '#f5a623' : '#fff'};
  line-height: 1.1;
`;

const StatLabel = styled.div`
  font-size: 0.6rem;
  color: #8892b0;
  margin-top: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ChipBadge = styled.div`
  display: inline-block;
  background: #f5a623;
  color: #1a0a2e;
  font-size: 0.7rem;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 10px;
  margin-top: 0.75rem;
  letter-spacing: 0.5px;
`;

const PitchWrapper = styled.div`
  flex: 1;
  padding: 0.75rem;
  overflow-y: auto;
`;

const Pitch = styled.div`
  background: linear-gradient(180deg,
    #2e7d32 0%, #388e3c 20%, #2e7d32 50%, #388e3c 80%, #2e7d32 100%);
  border-radius: 10px;
  padding: 1.25rem 0.5rem 1rem;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 56px; height: 56px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
    pointer-events: none;
  }
  &::after {
    content: '';
    position: absolute;
    top: 50%; left: 8%; right: 8%;
    height: 1px;
    background: rgba(255,255,255,0.2);
    pointer-events: none;
  }
`;

const PitchRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 2px;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
`;

const PlayerCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 62px;
`;

const PlayerNameLabel = styled.div`
  font-size: 0.6rem;
  font-weight: 600;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 62px;
  margin-top: 2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
`;

const PointsBadge = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  background: #1a0a2e;
  border-radius: 3px;
  padding: 1px 6px;
  margin-top: 2px;
  min-width: 20px;
  text-align: center;
`;

const BenchSection = styled.div`
  background: rgba(0,0,0,0.25);
  border-radius: 8px;
  padding: 0.75rem 0.5rem 0.5rem;
  margin-top: 0.75rem;
`;

const BenchLabel = styled.div`
  text-align: center;
  font-size: 0.68rem;
  color: #8892b0;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
`;

const BottomNav = styled.nav`
  position: sticky; bottom: 0;
  background: #2d0a5e;
  display: flex;
  border-top: 1px solid #4a1a8e;
  z-index: 100;
`;

const NavItem = styled.a`
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 0.6rem 0.25rem; text-decoration: none;
  color: ${({ active }) => (active ? '#f5a623' : '#8892b0')};
  font-size: 0.65rem; gap: 3px;
  border-top: 2px solid ${({ active }) => (active ? '#f5a623' : 'transparent')};
  &:hover { color: #f5a623; }
`;

const NavIcon = styled.span`font-size: 1.2rem;`;

const StatusMsg = styled.div`
  text-align: center; padding: 3rem 1rem;
  color: #8892b0; font-size: 0.9rem; line-height: 1.8;
  a { color: #f5a623; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupByPosition(players) {
  return [1, 2, 3, 4].map(type => players.filter(p => p.element_type === type));
}

function PlayerTile({ player }) {
  const pts = player.multiplier > 1
    ? player.event_points * player.multiplier
    : player.event_points;
  const isGkp = player.element_type === 1;

  return (
    <PlayerCard>
      <ShirtSVG
        teamId={player.team_id}
        isGkp={isGkp}
        isCaptain={player.is_captain}
        isVice={player.is_vice_captain}
        size={48}
      />
      <PlayerNameLabel>{player.web_name}</PlayerNameLabel>
      <PointsBadge>{pts}</PointsBadge>
    </PlayerCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyTeam() {
  const [user, setUser]       = useState(null);
  const [picks, setPicks]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [gw, setGw]           = useState(null);
  const [latestGW, setLatestGW] = useState(38);
  const [activeTab, setActiveTab] = useState('points'); // 'points' | 'odds'
  const [odds, setOdds]       = useState(null);

  // Fetch odds when tab switches to odds
  useEffect(() => {
    if (activeTab === 'odds' && !odds) {
      // First trigger a fetch (will use cache if fresh), then get the data
      fetch('/api/fetch-odds')
        .then(() => fetch('/api/fetch-odds?action=status'))
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.odds) setOdds(data.odds); })
        .catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
      else setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchPicks(user.id, gw);
  }, [user, gw]);

  async function fetchPicks(id, gameweek) {
    setLoading(true);
    setError(null);
    try {
      const url = gameweek
        ? `/api/fpl-picks?id=${id}&gw=${gameweek}`
        : `/api/fpl-picks?id=${id}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPicks(data);
      // Only set gw on first load
      if (!gw) setGw(data.gameweek);
      // latestGW from API tells us the true maximum
      if (data.latestGW) setLatestGW(data.latestGW);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    window.location.href = '/';
  };

  const history = picks?.entry_history;
  const rows    = picks ? groupByPosition(picks.starting) : [];
  const bench   = picks?.bench || [];

  // Calculate live GW points from starting XI (handles case where entry_history.points is 0)
  const liveGwPoints = picks?.starting
    ? picks.starting.reduce((sum, p) => sum + (p.event_points || 0) * (p.multiplier || 1), 0) - (history?.event_transfers_cost || 0)
    : null;
  const displayGwPoints = (history?.points && history.points > 0) ? history.points : (liveGwPoints || history?.points || '—');

  const canGoBack    = gw > 1;
  const canGoForward = gw < latestGW;

  return (
    <>
      <Head>
        <title>{user?.name || 'My Team'} — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="team" onLogout={handleLogout}>

          {!user && !loading && (
            <StatusMsg>
              Sign in to view your team.<br /><br />
              <a href="/signin">Enter your FPL Manager ID →</a>
            </StatusMsg>
          )}

          {user && (
            <>
              {/* Tab navigation */}
              <div style={{ display: 'flex', borderBottom: '1px solid #4a1a8e', background: '#2d0a5e' }}>
                <button onClick={() => setActiveTab('points')} style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: activeTab === 'points' ? '2px solid #f5a623' : '2px solid transparent', color: activeTab === 'points' ? '#f5a623' : '#8892b0', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', cursor: 'pointer' }}>Match Details</button>
                <button onClick={() => setActiveTab('odds')} style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: activeTab === 'odds' ? '2px solid #f5a623' : '2px solid transparent', color: activeTab === 'odds' ? '#f5a623' : '#8892b0', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', cursor: 'pointer' }}>Player Odds</button>
              </div>

              {activeTab === 'points' && (
              <>
              <GWHeader>
                <GWNav>
                  <GWBtn
                    onClick={() => canGoBack && setGw(g => g - 1)}
                    disabled={!canGoBack}
                    aria-label="Previous gameweek"
                  >‹</GWBtn>
                  <GWLabel>Gameweek {gw || '—'}</GWLabel>
                  <GWBtn
                    onClick={() => canGoForward && setGw(g => g + 1)}
                    disabled={!canGoForward}
                    aria-label="Next gameweek"
                  >›</GWBtn>
                </GWNav>

                {history && (
                  <StatsRow>
                    <StatBox>
                      <StatValue large>{displayGwPoints}</StatValue>
                      <StatLabel>GW Points</StatLabel>
                    </StatBox>
                    <StatBox>
                      <StatValue>{history.rank?.toLocaleString() ?? '—'}</StatValue>
                      <StatLabel>GW Rank</StatLabel>
                    </StatBox>
                    <StatBox>
                      <StatValue>{(history.overall_rank ?? user.overallRank)?.toLocaleString() ?? '—'}</StatValue>
                      <StatLabel>Overall Rank</StatLabel>
                    </StatBox>
                    <StatBox>
                      <StatValue>{history.event_transfers ?? '—'}</StatValue>
                      <StatLabel>Transfers</StatLabel>
                    </StatBox>
                  </StatsRow>
                )}

                {picks?.active_chip && (
                  <ChipBadge>
                    {picks.active_chip.replace(/_/g, ' ').toUpperCase()}
                  </ChipBadge>
                )}
              </GWHeader>

              <PitchWrapper>
                {loading && <StatusMsg>Loading team…</StatusMsg>}
                {error   && <StatusMsg>Could not load team.<br />{error}</StatusMsg>}

                {!loading && !error && picks && (
                  <>
                    <Pitch>
                      {rows.map((row, i) => (
                        <PitchRow key={i}>
                          {row.map(player => (
                            <PlayerTile key={player.element} player={player} />
                          ))}
                        </PitchRow>
                      ))}
                    </Pitch>

                    <BenchSection>
                      <BenchLabel>Substitutes</BenchLabel>
                      <PitchRow>
                        {bench.map(player => (
                          <PlayerTile key={player.element} player={player} />
                        ))}
                      </PitchRow>
                    </BenchSection>
                  </>
                )}
              </PitchWrapper>
            </>
            )}

              {activeTab === 'odds' && (
                <div style={{ padding: '0.5rem 0', paddingBottom: '70px' }}>
                  {/* Header banner */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0.5rem', background: '#f5a623', color: '#1a0a2e', fontWeight: 700, fontSize: '0.65rem', gap: '0' }}>
                    <span style={{ width: '28px', textAlign: 'center' }}>Pos</span>
                    <span style={{ width: '100px' }}>Player</span>
                    <span style={{ width: '55px', textAlign: 'center' }}>GW{gw}</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>First Goal</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>Anytime</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>2+</span>
                    <span style={{ flex: 1, textAlign: 'center' }}>Hat-trick</span>
                  </div>

                  {/* Player rows */}
                  {picks?.starting?.map(player => {
                    const posLabels = { 1: 'GK', 2: 'D', 3: 'M', 4: 'F' };
                    const posColors = { 1: '#f5a623', 2: '#48bb78', 3: '#63b3ed', 4: '#fc8181' };

                    // Match player to odds by last name (odds use full names)
                    let playerOdds = null;
                    if (odds) {
                      const lastName = (player.web_name || '').toLowerCase();
                      const fullName = (player.name || '').toLowerCase();
                      // Try exact web_name match, then last name match
                      playerOdds = Object.values(odds).find(o => {
                        const oddsName = (o.name || '').toLowerCase();
                        return oddsName === fullName ||
                               oddsName.includes(lastName) ||
                               lastName.includes(oddsName.split(' ').pop());
                      });
                    }

                    return (
                      <div key={player.element} style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0.5rem', borderBottom: '1px solid #2d1a4e', fontSize: '0.72rem' }}>
                        <span style={{ width: '28px', textAlign: 'center', color: posColors[player.element_type] || '#ccc', fontWeight: 700 }}>{posLabels[player.element_type]}</span>
                        <div style={{ width: '100px' }}>
                          <div style={{ fontWeight: 700, color: '#eaeaea', fontSize: '0.78rem' }}>{player.web_name}</div>
                          <div style={{ color: '#8892b0', fontSize: '0.65rem' }}>{player.team_name || player.team_short}</div>
                        </div>
                        <span style={{ width: '55px', textAlign: 'center', color: '#8892b0', fontSize: '0.7rem' }}>{playerOdds?.fixture || '—'}</span>
                        <span style={{ flex: 1, textAlign: 'center', color: '#f5a623', fontSize: '0.72rem' }}>{playerOdds?.firstGoal ? `${playerOdds.firstGoal.odds}` : '—'}</span>
                        <span style={{ flex: 1, textAlign: 'center', color: '#f5a623', fontSize: '0.72rem' }}>{playerOdds?.anytime ? `${playerOdds.anytime.odds}` : '—'}</span>
                        <span style={{ flex: 1, textAlign: 'center', color: '#8892b0' }}>—</span>
                        <span style={{ flex: 1, textAlign: 'center', color: '#8892b0' }}>—</span>
                      </div>
                    );
                  })}

                  {(!picks?.starting || picks.starting.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#8892b0' }}>
                      Sign in to see your team's player odds
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href="/my-team" active={1}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard"><NavIcon>🏆</NavIcon>Leaderboard</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes"><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
