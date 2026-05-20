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
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

// ── Team shirt colour map (by FPL team_id) ────────────────────────────────────
// Colours only — no logos. Pattern: solid | stripes | hoops | halves
// IDs from FPL: 1=Arsenal, 2=Villa, 3=Burnley, 4=Bournemouth, 5=Brentford, 6=Brighton,
// 7=Chelsea, 8=Crystal Palace, 9=Everton, 10=Fulham, 11=Leeds, 12=Liverpool,
// 13=Man City, 14=Man Utd, 15=Newcastle, 16=Nott'm Forest, 17=Sunderland,
// 18=Spurs, 19=West Ham, 20=Wolves
const TEAM_COLOURS = {
  1:  { primary: '#EF0107', secondary: '#ffffff', pattern: 'solid' },     // Arsenal - red with white sleeves
  2:  { primary: '#670E36', secondary: '#95BFE5', pattern: 'solid' },     // Aston Villa - brown with light blue sleeves
  3:  { primary: '#670E36', secondary: '#95BFE5', pattern: 'solid' },     // Burnley - brown with light blue sleeves
  4:  { primary: '#8B0000', secondary: '#000000', pattern: 'stripes' },   // Bournemouth - dark red and black stripes
  5:  { primary: '#E30613', secondary: '#ffffff', pattern: 'stripes' },   // Brentford - red and white stripes
  6:  { primary: '#0057B8', secondary: '#ffffff', pattern: 'stripes' },   // Brighton - dark blue and white stripes
  7:  { primary: '#034694', secondary: '#034694', pattern: 'solid' },     // Chelsea - dark blue
  8:  { primary: '#1B458F', secondary: '#C4122E', pattern: 'stripes' },   // Crystal Palace - dark blue and red stripes
  9:  { primary: '#003399', secondary: '#003399', pattern: 'solid' },     // Everton - blue
  10: { primary: '#ffffff', secondary: '#000000', pattern: 'solid' },     // Fulham - white with black sleeves
  11: { primary: '#ffffff', secondary: '#ffffff', pattern: 'solid' },     // Leeds - white
  12: { primary: '#C8102E', secondary: '#C8102E', pattern: 'solid' },     // Liverpool - dark red
  13: { primary: '#6CABDD', secondary: '#6CABDD', pattern: 'solid' },     // Man City - light blue
  14: { primary: '#DA291C', secondary: '#DA291C', pattern: 'solid' },     // Man Utd - red
  15: { primary: '#241F20', secondary: '#ffffff', pattern: 'stripes' },   // Newcastle - black and white stripes
  16: { primary: '#E53233', secondary: '#ffffff', pattern: 'stripes' },   // Nott'm Forest - red and white stripes
  17: { primary: '#8B0000', secondary: '#ffffff', pattern: 'stripes' },   // Sunderland - dark red and white stripes
  18: { primary: '#ffffff', secondary: '#132257', pattern: 'solid' },     // Spurs - white with dark blue sleeves
  19: { primary: '#7A263A', secondary: '#1BB1E7', pattern: 'solid' },     // West Ham - dark brown with light blue sleeves
  20: { primary: '#FDB913', secondary: '#FDB913', pattern: 'solid' },     // Wolves - orange
};

const GKP_COLOURS = null; // GKs now use same colours as outfield
const DEFAULT_COLOURS = { primary: '#1a3a6e', secondary: '#ffffff', pattern: 'solid' };

function getShirtColours(teamId, isGkp) {
  return TEAM_COLOURS[teamId] || DEFAULT_COLOURS;
}

// ── Shirt SVG component ───────────────────────────────────────────────────────
function ShirtSVG({ teamId, isGkp, isCaptain, isVice, size = 52, playerId }) {
  const { primary, secondary, pattern } = getShirtColours(teamId, isGkp);

  // Generate stripe rects manually (more reliable than SVG patterns in React)
  const stripes = [];
  if (pattern === 'stripes') {
    for (let x = 0; x < 52; x += 6) {
      stripes.push(
        <rect key={`s-${x}`} x={x} y="0" width="3" height="58" fill={secondary} />
      );
    }
  }

  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 52 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`clip-body-${teamId}-${playerId || 0}`}>
          <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" />
        </clipPath>
        <clipPath id={`clip-lsleeve-${teamId}-${playerId || 0}`}>
          <path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" />
        </clipPath>
        <clipPath id={`clip-rsleeve-${teamId}-${playerId || 0}`}>
          <path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" />
        </clipPath>
      </defs>

      {/* Solid background to prevent pitch showing through */}
      <path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" fill={pattern === 'stripes' ? primary : secondary} />
      <path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" fill={pattern === 'stripes' ? primary : secondary} />
      <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" fill={primary} />

      {/* Left sleeve */}
      <g clipPath={`url(#clip-lsleeve-${teamId}-${playerId || 0})`}>
        <rect x="0" y="0" width="52" height="58" fill={pattern === 'stripes' ? primary : secondary} />
        {pattern === 'stripes' && stripes}
      </g>
      {/* Right sleeve */}
      <g clipPath={`url(#clip-rsleeve-${teamId}-${playerId || 0})`}>
        <rect x="0" y="0" width="52" height="58" fill={pattern === 'stripes' ? primary : secondary} />
        {pattern === 'stripes' && stripes}
      </g>
      {/* Body - solid background first to prevent transparency */}
      <g clipPath={`url(#clip-body-${teamId}-${playerId || 0})`}>
        <rect x="0" y="0" width="52" height="58" fill={primary} />
        {pattern === 'stripes' && stripes}
      </g>

      {/* Outlines */}
      <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      <path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
      {/* Collar */}
      <path d="M18 2 C20 5 23 7 26 7 C29 7 32 5 34 2" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2"/>

      {/* Captain / Vice badge */}
      {isCaptain && (
        <>
          <circle cx="46" cy="5" r="10" fill="#f5a623" stroke="#fff" strokeWidth="1.5"/>
          <text x="46" y="10" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1a0a2e">C</text>
        </>
      )}
      {isVice && (
        <>
          <circle cx="46" cy="5" r="10" fill="#9b59b6" stroke="#fff" strokeWidth="1.5"/>
          <text x="46" y="10" textAnchor="middle" fontSize="12" fontWeight="bold" fill="#fff">V</text>
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
  padding: 0.5rem;
  overflow-y: auto;
  padding-bottom: 70px;
`;

const Pitch = styled.div`
  background: linear-gradient(180deg,
    #2d8a30 0%, #34963a 8%, #2d8a30 16%, #34963a 24%, #2d8a30 32%, #34963a 40%,
    #2d8a30 48%, #34963a 56%, #2d8a30 64%, #34963a 72%, #2d8a30 80%, #34963a 88%, #2d8a30 100%);
  border-radius: 10px;
  padding: 0 0.25rem 1rem;
  position: relative;
  overflow: hidden;
`;

const PitchBanner = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.25rem;
  margin-bottom: 0.25rem;
`;

const BannerHalf = styled.div`
  background: ${({ side }) => side === 'left' ? '#6c2eb9' : '#2d0a5e'};
  padding: 0.3rem 0.6rem;
  font-size: 0.6rem;
  font-weight: 800;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 3px;
  border-radius: 4px;
  span { color: #f5a623; }
`;

const PitchMarkings = styled.div`
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  pointer-events: none;
  /* Centre circle */
  &::before {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 80px; height: 80px;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.2);
  }
  /* Half-way line */
  &::after {
    content: '';
    position: absolute;
    top: 50%; left: 3%; right: 3%;
    height: 1.5px;
    background: rgba(255,255,255,0.2);
  }
`;

const GoalArea = styled.div`
  position: absolute;
  top: 28px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 40px;
  border: 1.5px solid rgba(255,255,255,0.25);
  border-top: none;
  border-radius: 0 0 4px 4px;
  pointer-events: none;
  /* Goal net */
  &::before {
    content: '';
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    width: 50px;
    height: 20px;
    border: 1.5px solid rgba(255,255,255,0.3);
    border-top: 2px solid rgba(255,255,255,0.4);
    border-radius: 2px 2px 0 0;
  }
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
  ${({ live }) => live && 'animation: pulse-dot 1.5s infinite;'}
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

const BenchPosLabel = styled.div`
  font-size: 0.5rem;
  color: rgba(255,255,255,0.7);
  font-weight: 700;
  text-align: center;
  margin-bottom: 2px;
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

function PlayerTile({ player, onPlayerClick }) {
  const pts = player.multiplier > 1
    ? player.event_points * player.multiplier
    : player.event_points;
  const isGkp = player.element_type === 1;
  const posLabels = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

  return (
    <PlayerCard onClick={() => onPlayerClick && onPlayerClick(player)} style={{ cursor: 'pointer' }}>
      <ShirtSVG
        teamId={player.team_id}
        isGkp={isGkp}
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyTeam() {
  const [user, setUser]       = useState(null);
  const [picks, setPicks]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [gw, setGw]           = useState(null);
  const [latestGW, setLatestGW] = useState(38);
  const [activeTab, setActiveTab] = useState('points'); // 'points' | 'odds'

  // Read tab from URL query param (for menu deep links)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'odds') setActiveTab('odds');
      if (tab === 'points') setActiveTab('points');
    }
  }, []);
  const [odds, setOdds]       = useState(null);
  const [selectedMarket, setSelectedMarket] = useState('anytime');
  const [oddsMarketOpen, setOddsMarket] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerDetail, setPlayerDetail] = useState(null);
  const [gwDropdownOpen, setGwDropdownOpen] = useState(false);

  function fetchPlayerDetail(player) {
    fetch(`/api/player-detail?id=${player.element}&gw=${gw}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setPlayerDetail(data))
      .catch(() => setPlayerDetail(null));
  }
  const oddsMarketLabel = { anytime: 'To Score Anytime', firstGoal: 'First Goalscorer', twoPlus: '2 or More Goals', hatTrick: 'Hat-trick', assists: 'To Get Assist', yellowCard: 'Yellow Card', redCard: 'Red Card' }[selectedMarket] || 'To Score Anytime';

  // Bookie logo mapping — images stored in /public/logos/
  function getBookieLogo(bookie) {
    const name = (bookie || '').toLowerCase().replace(/\s+/g, '');
    const logoMap = {
      'bet365': '/logos/bet365',
      '1xbet': '/logos/1xbet',
      'betfair': '/logos/betfair',
      'betfairsportsbook': '/logos/betfair',
      'unibet': '/logos/unibet',
      'unibetuk': '/logos/unibet',
      'paddypower': '/logos/paddypower',
      'williamhill': '/logos/williamhill',
      'skybet': '/logos/skybet',
      'ladbrokes': '/logos/ladbrokes',
      'coral': '/logos/coral',
      'betway': '/logos/betway',
      '888sport': '/logos/888sport',
      'fanduel': '/logos/fanduel',
      'draftkings': '/logos/draftkings',
      'betmgm': '/logos/betmgm',
      'livescorebet': '/logos/livescorebet',
      'livescore': '/logos/livescorebet',
      'boylesports': '/logos/boylesports',
      'betvictor': '/logos/betvictor',
    };
    let base = logoMap[name];
    if (!base) {
      for (const [key, url] of Object.entries(logoMap)) {
        if (name.includes(key) || key.includes(name)) { base = url; break; }
      }
    }
    // Try .png first, browser will fallback via onerror
    return base ? `${base}.png` : '';
  }

  // Fetch odds when tab switches to odds
  useEffect(() => {
    if (activeTab === 'odds' && !odds) {
      fetch('/api/livescore-odds')
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
  const displayGwPoints = liveGwPoints !== null ? liveGwPoints : (history?.points || '—');

  const canGoBack    = gw > 1;
  const canGoForward = gw < 38;

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
                <button onClick={() => setActiveTab('points')} style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: activeTab === 'points' ? '2px solid #f5a623' : '2px solid transparent', color: activeTab === 'points' ? '#f5a623' : '#8892b0', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', cursor: 'pointer' }}>Team Points</button>
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
                  <GWLabel style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setGwDropdownOpen(o => !o)}>
                    Gameweek {gw || '—'} <span style={{ fontSize: '0.7rem', color: '#f5a623' }}>▼</span>
                    {gwDropdownOpen && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#2d0a5e', border: '1px solid #4a1a8e', borderRadius: '6px', zIndex: 50, marginTop: '6px', maxHeight: '200px', overflowY: 'auto', width: '140px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        {Array.from({ length: 38 }, (_, i) => i + 1).map(n => (
                          <div key={n} onClick={() => { setGw(n); setGwDropdownOpen(false); }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: n === gw ? '#f5a623' : '#ccc', fontWeight: n === gw ? 700 : 400, background: n === gw ? 'rgba(245,166,35,0.1)' : 'transparent', cursor: 'pointer', borderBottom: '1px solid #4a1a8e' }}>
                            Gameweek {n}
                          </div>
                        ))}
                      </div>
                    )}
                  </GWLabel>
                  <GWBtn
                    onClick={() => canGoForward && setGw(g => g + 1)}
                    disabled={!canGoForward}
                    aria-label="Next gameweek"
                  >›</GWBtn>
                </GWNav>

                {/* Current Round Active indicator */}
                {gw === latestGW && (
                  <div style={{ textAlign: 'center', padding: '0.3rem 0', fontSize: '0.65rem', color: '#48bb78', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#48bb78', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
                    CURRENT ROUND ACTIVE
                  </div>
                )}

                {history && (
                  <StatsRow>
                    <StatBox>
                      <StatValue large>
                        {gw === latestGW && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#48bb78', marginRight: '4px', animation: 'pulse-dot 1.5s infinite' }} />}
                        {displayGwPoints}
                      </StatValue>
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
                    {picks.active_chip === '3xc' ? 'Triple Captain Played' :
                     picks.active_chip === 'bboost' ? 'Bench Boost Played' :
                     picks.active_chip === 'wildcard' ? 'Wildcard Played' :
                     picks.active_chip === 'freehit' ? 'Free Hit Played' :
                     picks.active_chip.replace(/_/g, ' ').toUpperCase()}
                  </ChipBadge>
                )}
              </GWHeader>

              <PitchWrapper>
                {loading && <StatusMsg>Loading team…</StatusMsg>}
                {error   && <StatusMsg>Could not load team.<br />{error}</StatusMsg>}

                {!loading && !error && picks && (
                  <>
                    <Pitch>
                      <PitchBanner>
                        <BannerHalf side="left">⚽ Vidi<span>Goals</span></BannerHalf>
                        <BannerHalf side="right">⚽ Vidi<span>Goals</span></BannerHalf>
                      </PitchBanner>
                      <PitchMarkings />
                      <GoalArea />
                      {rows.map((row, i) => (
                        <PitchRow key={i}>
                          {row.map(player => (
                            <PlayerTile key={player.element} player={player} onPlayerClick={(p) => { setSelectedPlayer(p); fetchPlayerDetail(p); }} />
                          ))}
                        </PitchRow>
                      ))}
                    </Pitch>

                    <BenchSection>
                      <BenchLabel>YOUR BENCH</BenchLabel>
                      <PitchRow>
                        {bench.map(player => {
                          const posLabels = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
                          return (
                            <div key={player.element} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <BenchPosLabel>{posLabels[player.element_type] || ''}</BenchPosLabel>
                              <PlayerTile player={player} onPlayerClick={(p) => { setSelectedPlayer(p); fetchPlayerDetail(p); }} />
                            </div>
                          );
                        })}
                      </PitchRow>
                    </BenchSection>
                  </>
                )}
              </PitchWrapper>
            </>
            )}

              {activeTab === 'odds' && (
                <div style={{ padding: '0.5rem 0', paddingBottom: '70px' }}>
                  {/* GW Navigation - centered */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', gap: '1.5rem', background: '#2d0a5e', borderBottom: '1px solid #4a1a8e' }}>
                    <button onClick={() => gw > 1 && setGw(g => g - 1)} disabled={gw <= 1} style={{ background: 'transparent', border: 'none', color: gw > 1 ? '#f5a623' : '#4a1a8e', fontSize: '1.5rem', cursor: gw > 1 ? 'pointer' : 'not-allowed' }}>‹</button>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>Gameweek {gw}</span>
                    <button onClick={() => gw < 38 && setGw(g => g + 1)} disabled={gw >= 38} style={{ background: 'transparent', border: 'none', color: gw < 38 ? '#f5a623' : '#4a1a8e', fontSize: '1.5rem', cursor: gw < 38 ? 'pointer' : 'not-allowed' }}>›</button>
                  </div>

                  {/* Header banner with market switcher */}
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0.5rem', background: '#f5a623', color: '#1a0a2e', fontWeight: 700, fontSize: '0.7rem' }}>
                    <span style={{ width: '28px', textAlign: 'center' }}>Pos</span>
                    <span style={{ flex: 1 }}>Player</span>
                    <span style={{ width: '65px', textAlign: 'center' }}>GW{gw}</span>
                    {/* Market switcher in header */}
                    <div style={{ width: '160px', position: 'relative' }}>
                      <button onClick={() => setOddsMarket(m => !m)} style={{ background: 'transparent', border: 'none', color: '#1a0a2e', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                        {oddsMarketLabel} {oddsMarketOpen ? '▲' : '▼'}
                      </button>
                      {oddsMarketOpen && (
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
                            <button key={m.key} onClick={() => { setSelectedMarket(m.key); setOddsMarket(false); }} style={{ display: 'block', width: '100%', background: selectedMarket === m.key ? 'rgba(245,166,35,0.15)' : 'transparent', border: 'none', color: selectedMarket === m.key ? '#f5a623' : '#ccc', fontSize: '0.78rem', padding: '0.6rem 0.8rem', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #4a1a8e' }}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Player rows */}
                  {[...(picks?.starting || []), ...(picks?.bench || [])].map(player => {
                    const posLabels = { 1: 'GK', 2: 'D', 3: 'M', 4: 'F' };
                    const posColors = { 1: '#f5a623', 2: '#48bb78', 3: '#63b3ed', 4: '#fc8181' };

                    // Match player to odds by name
                    let playerOdds = null;
                    if (odds) {
                      const webName = (player.web_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
                      const fullName = (player.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
                      const lastName = fullName.split(' ').pop() || '';
                      const match = Object.values(odds).find(o => {
                        const oddsName = (o.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
                        const oddsLast = oddsName.split(' ').pop() || '';
                        if (oddsName === fullName) return true;
                        if (oddsName.includes(webName)) return true;
                        if (webName.includes(oddsLast) && oddsLast.length > 3) return true;
                        if (oddsLast === lastName && lastName.length > 3) return true;
                        if (webName.includes('-') && oddsName.includes(webName)) return true;
                        if (oddsName.includes('-') && webName.includes(oddsName.split(' ').pop())) return true;
                        return false;
                      });
                      // Only show odds if the fixture matches (odds are for a specific match)
                      if (match && player.fixture) {
                        const oddsFixture = (match.fixture || '').toLowerCase();
                        const playerTeam = (player.team_name || '').toLowerCase();
                        const playerShort = (player.team_short || '').toLowerCase();
                        // Check if the odds fixture involves this player's team
                        // Handle name variations: Spurs/Tottenham, Wolves/Wolverhampton, etc.
                        const teamVariants = [playerTeam, playerShort];
                        if (playerTeam === 'spurs') teamVariants.push('tottenham');
                        if (playerTeam === 'wolves') teamVariants.push('wolverhampton');
                        if (playerTeam.includes('man city')) teamVariants.push('manchester city');
                        if (playerTeam.includes('man utd')) teamVariants.push('manchester united');
                        if (playerTeam.includes("nott'm forest")) teamVariants.push('nottingham forest');
                        
                        const fixtureMatches = teamVariants.some(v => oddsFixture.includes(v));
                        if (fixtureMatches) {
                          playerOdds = match;
                        }
                      }
                    }

                    // Get odds for selected market
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
                              if (selectedMarket === 'anytime' || selectedMarket === 'firstGoal' || selectedMarket === 'twoPlus' || selectedMarket === 'hatTrick') {
                                return player.goalsScored > 0 ? '#48bb78' : '#8892b0';
                              }
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
                            <a
                              href={playerOdds?.eventUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', textDecoration: 'none', cursor: 'pointer', width: '100%' }}
                            >
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

        {/* Player Detail Popup */}
        {selectedPlayer && (
          <div onClick={() => { setSelectedPlayer(null); setPlayerDetail(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '360px', maxHeight: '80vh', overflow: 'auto', color: '#333' }}>
              {/* Header - Total Points */}
              <div style={{ textAlign: 'center', padding: '1rem', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'inline-block', background: '#1a0a2e', color: '#fff', fontWeight: 800, fontSize: '1.1rem', padding: '0.4rem 1.2rem', borderRadius: '20px', marginBottom: '0.5rem' }}>
                  {playerDetail?.totalPoints ?? selectedPlayer.event_points * (selectedPlayer.multiplier || 1)} POINTS
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a0a2e' }}>{selectedPlayer.name || selectedPlayer.web_name}</div>
                {/* Close button */}
                <button onClick={() => { setSelectedPlayer(null); setPlayerDetail(null); }} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#999', cursor: 'pointer' }}>×</button>
              </div>

              {/* Fixture + Score */}
              {playerDetail?.fixture && (
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <span>{playerDetail.fixture.home}</span>
                    <span style={{ background: playerDetail.fixture.finished ? '#6c2eb9' : '#48bb78', color: '#fff', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', fontSize: '0.9rem' }}>
                      {playerDetail.fixture.homeScore ?? 0} - {playerDetail.fixture.awayScore ?? 0}
                    </span>
                    <span>{playerDetail.fixture.away}</span>
                  </div>
                  {playerDetail.fixture.minutes && (
                    <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>{playerDetail.fixture.finished ? 'FT' : `${playerDetail.fixture.minutes}'`}</div>
                  )}
                </div>
              )}

              {/* xG and xA */}
              {playerDetail && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700, border: '1px solid #ddd', borderRadius: '3px', padding: '1px 6px', display: 'inline-block' }}>xG</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>{playerDetail.xG}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700, border: '1px solid #ddd', borderRadius: '3px', padding: '1px 6px', display: 'inline-block' }}>xA</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '2px' }}>{playerDetail.xA}</div>
                  </div>
                </div>
              )}

              {/* Points Breakdown */}
              {playerDetail?.breakdown?.length > 0 && (
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#888', fontWeight: 700, marginBottom: '0.5rem', padding: '0 0.25rem' }}>
                    <span>Statistic</span>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                      <span>Value</span>
                      <span>Points</span>
                    </div>
                  </div>
                  {playerDetail.breakdown.map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.25rem', borderTop: '1px solid #f0f0f0', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 600 }}>{b.stat}</span>
                      <div style={{ display: 'flex', gap: '2rem' }}>
                        <span style={{ color: '#666', minWidth: '30px', textAlign: 'right' }}>{b.value}</span>
                        <span style={{ fontWeight: 700, color: b.points > 0 ? '#48bb78' : b.points < 0 ? '#fc8181' : '#666', minWidth: '40px', textAlign: 'right' }}>{b.points} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!playerDetail && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading...</div>
              )}
            </div>
          </div>
        )}

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href="/my-team" active={1}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard"><NavIcon>🏆</NavIcon>Leagues</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes"><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
