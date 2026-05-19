import { useState, useEffect } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle } from 'styled-components';
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

// ── Team shirt colours (same as my-team.js) ───────────────────────────────────
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

function ShirtSVG({ teamId, size = 28 }) {
  const { primary, secondary, pattern } = TEAM_COLOURS[teamId] || { primary: '#1a3a6e', secondary: '#ffffff', pattern: 'solid' };
  const stripes = [];
  if (pattern === 'stripes') {
    for (let x = 0; x < 52; x += 6) {
      stripes.push(<rect key={x} x={x} y="0" width="3" height="58" fill={secondary} />);
    }
  }
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 52 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id={`pc-body-${teamId}`}><path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" /></clipPath>
        <clipPath id={`pc-ls-${teamId}`}><path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" /></clipPath>
        <clipPath id={`pc-rs-${teamId}`}><path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" /></clipPath>
      </defs>
      <path d="M14 4 L2 12 L2 24 L10 20 L10 4Z" fill={pattern === 'stripes' ? primary : secondary} />
      <path d="M38 4 L50 12 L50 24 L42 20 L42 4Z" fill={pattern === 'stripes' ? primary : secondary} />
      <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" fill={primary} />
      <g clipPath={`url(#pc-ls-${teamId})`}><rect x="0" y="0" width="52" height="58" fill={pattern === 'stripes' ? primary : secondary} />{pattern === 'stripes' && stripes}</g>
      <g clipPath={`url(#pc-rs-${teamId})`}><rect x="0" y="0" width="52" height="58" fill={pattern === 'stripes' ? primary : secondary} />{pattern === 'stripes' && stripes}</g>
      <g clipPath={`url(#pc-body-${teamId})`}><rect x="0" y="0" width="52" height="58" fill={primary} />{pattern === 'stripes' && stripes}</g>
      <path d="M10 4 L10 54 L42 54 L42 4 L38 2 C36 6 30 8 26 8 C22 8 16 6 14 2Z" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
    </svg>
  );
}

const Wrapper = styled.div`
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a0a2e;
`;

const TabRow = styled.div`
  display: flex;
  background: #2d0a5e;
  border-bottom: 1px solid #4a1a8e;
`;

const Tab = styled.button`
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid ${({ active }) => active ? '#48bb78' : 'transparent'};
  color: ${({ active }) => active ? '#48bb78' : '#8892b0'};
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.75rem;
  cursor: pointer;
  &:last-child {
    border-bottom-color: ${({ active }) => active ? '#fc8181' : 'transparent'};
    color: ${({ active }) => active ? '#fc8181' : '#8892b0'};
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: 70px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(45, 10, 94, 0.5);
  border-bottom: 1px solid #4a1a8e;
  font-size: 0.62rem;
  font-weight: 700;
  color: #8892b0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const PlayerRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.7rem 0.75rem;
  border-bottom: 1px solid #2d1a4e;
  &:hover { background: rgba(108,46,185,0.08); }
`;

const ProgressBadge = styled.span`
  display: inline-block;
  min-width: 52px;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 3px 6px;
  border-radius: 4px;
  color: #fff;
  background: ${({ value, direction }) => {
    if (direction === 'fall') {
      if (value >= 90) return '#e53e3e';
      if (value >= 70) return '#fc8181';
      return '#feb2b2';
    }
    if (value >= 90) return '#38a169';
    if (value >= 70) return '#48bb78';
    if (value >= 50) return '#68d391';
    return '#9ae6b4';
  }};
`;

const ProgressBarOuter = styled.div`
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 3px;
`;

const ProgressBarInner = styled.div`
  height: 100%;
  border-radius: 3px;
  width: ${({ pct }) => Math.min(pct, 100)}%;
  background: ${({ direction }) => direction === 'rise' ? '#48bb78' : '#fc8181'};
  transition: width 0.3s;
`;

const ChangeTimeBadge = styled.span`
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  background: ${({ tonight }) => tonight ? '#48bb78' : 'rgba(255,255,255,0.08)'};
  color: ${({ tonight }) => tonight ? '#1a0a2e' : '#8892b0'};
`;

const StatusDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  background: ${({ status }) => {
    if (status === 'a') return '#48bb78';
    if (status === 'd') return '#f5a623';
    if (status === 'i') return '#fc8181';
    return '#8892b0';
  }};
`;

const NetBadge = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  color: ${({ positive }) => positive ? '#48bb78' : '#fc8181'};
`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.6;
`;

const LastUpdated = styled.div`
  text-align: center;
  padding: 0.4rem;
  font-size: 0.6rem;
  color: #4a1a8e;
`;

const BottomNav = styled.nav`
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: #2d0a5e;
  display: flex;
  border-top: 1px solid #4a1a8e;
  z-index: 9999;
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

export default function PriceChanges() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('risers'); // 'risers' | 'fallers'

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    fetch('/api/price-changes')
      .then(r => r.ok ? r.json() : Promise.reject('Failed'))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(typeof e === 'string' ? e : e.message); setLoading(false); });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  const players = activeTab === 'risers' ? (data?.risers || []) : (data?.fallers || []);

  return (
    <>
      <Head>
        <title>Price Changes — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="price-changes" onLogout={handleLogout}>
          <TabRow>
            <Tab active={activeTab === 'risers' ? 1 : 0} onClick={() => setActiveTab('risers')}>
              📈 Risers ({data?.risers?.length || 0})
            </Tab>
            <Tab active={activeTab === 'fallers' ? 1 : 0} onClick={() => setActiveTab('fallers')}>
              📉 Fallers ({data?.fallers?.length || 0})
            </Tab>
          </TabRow>

          <Content>
            {loading && <StatusMsg>Loading price predictions…</StatusMsg>}
            {error && <StatusMsg>Could not load data.<br />{error}</StatusMsg>}

            {!loading && !error && players.length === 0 && (
              <StatusMsg>No {activeTab === 'risers' ? 'risers' : 'fallers'} predicted right now.</StatusMsg>
            )}

            {!loading && !error && players.length > 0 && (
              <>
                {/* Column headers */}
                <HeaderRow>
                  <span style={{ width: '140px' }}>Player</span>
                  <span style={{ width: '50px', textAlign: 'center' }}>Price</span>
                  <span style={{ width: '50px', textAlign: 'center' }}>Own%</span>
                  <span style={{ flex: 1, textAlign: 'center' }}>Progress</span>
                  <span style={{ width: '60px', textAlign: 'center' }}>Time</span>
                </HeaderRow>

                {players.map(player => (
                  <PlayerRow key={player.id}>
                    {/* Shirt + Player info */}
                    <div style={{ width: '140px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShirtSVG teamId={player.teamId} size={26} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#eaeaea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{player.name}</span>
                        <div style={{ fontSize: '0.6rem', color: '#8892b0', marginTop: '1px' }}>
                          {player.position} · {player.teamShort}
                        </div>
                      </div>
                    </div>

                    {/* Status icon between name and price */}
                    <div style={{ width: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {player.status === 'i' && <span style={{ fontSize: '0.85rem' }} title="Injured">🏥</span>}
                      {player.status === 's' && <span style={{ fontSize: '0.85rem' }} title="Suspended">🚫</span>}
                      {player.status === 'd' && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f5a623', display: 'inline-block' }} title="Doubtful" />}
                      {player.status === 'a' && <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#48bb78', display: 'inline-block' }} title="Available" />}
                      {player.status === 'u' && <span style={{ fontSize: '0.85rem' }} title="Unavailable">❌</span>}
                    </div>

                    {/* Price */}
                    <div style={{ width: '50px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>£{player.price}</div>
                    </div>

                    {/* Ownership */}
                    <div style={{ width: '50px', textAlign: 'center', fontSize: '0.72rem', color: '#8892b0' }}>
                      {player.ownership}%
                    </div>

                    {/* Progress */}
                    <div style={{ flex: 1, padding: '0 0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <ProgressBadge value={player.progress} direction={player.direction}>
                          {player.progress.toFixed(1)}%
                        </ProgressBadge>
                        <NetBadge positive={player.direction === 'rise'}>
                          {player.direction === 'rise' ? '▲' : '▼'}
                        </NetBadge>
                      </div>
                      <ProgressBarOuter>
                        <ProgressBarInner pct={player.progress} direction={player.direction} />
                      </ProgressBarOuter>
                    </div>

                    {/* Change time */}
                    <div style={{ width: '60px', textAlign: 'center' }}>
                      <ChangeTimeBadge tonight={player.changeTime === 'Tonight' ? 1 : 0}>
                        {player.changeTime}
                      </ChangeTimeBadge>
                    </div>
                  </PlayerRow>
                ))}

                {data?.lastUpdated && (
                  <LastUpdated>
                    Last updated: {new Date(data.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                  </LastUpdated>
                )}
              </>
            )}
          </Content>
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard"><NavIcon>🏆</NavIcon>Leaderboard</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes" active={1}><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
