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
  border-bottom: 2px solid ${({ active }) => active ? '#f5a623' : 'transparent'};
  color: ${({ active }) => active ? '#f5a623' : '#8892b0'};
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.75rem;
  cursor: pointer;
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-bottom: 70px;
`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.6;
  a { color: #f5a623; text-decoration: none; }
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

// VidiGoals League Code (FPL league)
const VIDIGOALS_LEAGUE_CODE = 'V5497Y';
const VIDIGOALS_LEAGUE_ID = 1234567; // Replace with actual FPL league ID

export default function Leaderboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('vidigoals');
  const [gw, setGw] = useState(null);
  const [standings, setStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [myLeagues, setMyLeagues] = useState(null);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueStandings, setLeagueStandings] = useState(null);
  const [loadingLeagueStandings, setLoadingLeagueStandings] = useState(false);
  const [viewMode, setViewMode] = useState('gw'); // 'gw' | 'overall'

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  // Fetch VidiGoals league standings
  useEffect(() => {
    setLoadingStandings(true);
    fetch(`/api/leagues?leagueId=${VIDIGOALS_LEAGUE_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setStandings(data);
          // Determine current GW from first entry's event_total
          if (!gw && data.standings?.length > 0) {
            // We'll get GW from bootstrap
            fetch('/api/fpl-picks?id=' + (user?.id || '1'))
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.gameweek) setGw(d.gameweek); })
              .catch(() => setGw(37));
          }
        }
        setLoadingStandings(false);
      })
      .catch(() => setLoadingStandings(false));
  }, []);

  // Fetch My Leagues when tab switches
  useEffect(() => {
    if (activeTab === 'myleagues' && user?.id && !myLeagues) {
      setLoadingLeagues(true);
      fetch(`/api/leagues?id=${user.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { setMyLeagues(data); setLoadingLeagues(false); })
        .catch(() => setLoadingLeagues(false));
    }
  }, [activeTab, user]);

  // Fetch specific league standings
  function openLeague(league) {
    setSelectedLeague(league);
    setLoadingLeagueStandings(true);
    fetch(`/api/leagues?leagueId=${league.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setLeagueStandings(data); setLoadingLeagueStandings(false); })
      .catch(() => setLoadingLeagueStandings(false));
  }

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  // Sort standings by GW points or overall
  const sortedStandings = standings?.standings
    ? [...standings.standings].sort((a, b) => viewMode === 'overall' ? b.total - a.total : b.eventTotal - a.eventTotal)
    : [];

  const winner = sortedStandings[0] || null;

  return (
    <>
      <Head>
        <title>Leaderboard — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="leaderboard" onLogout={handleLogout}>
          <TabRow>
            <Tab active={activeTab === 'vidigoals' ? 1 : 0} onClick={() => { setActiveTab('vidigoals'); setSelectedLeague(null); }}>VidiGoals</Tab>
            <Tab active={activeTab === 'myleagues' ? 1 : 0} onClick={() => { setActiveTab('myleagues'); setSelectedLeague(null); }}>My Leagues</Tab>
          </TabRow>

          <Content>
            {/* ── VidiGoals Tab ── */}
            {activeTab === 'vidigoals' && (
              <>
                {/* League code + join */}
                <div style={{ padding: '1rem', borderBottom: '1px solid #4a1a8e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ color: '#f5a623', fontWeight: 700, fontSize: '0.9rem' }}>Code: {VIDIGOALS_LEAGUE_CODE}</span>
                    </div>
                    <a href="https://fantasy.premierleague.com/leagues/join" target="_blank" rel="noopener noreferrer" style={{ background: '#4a1a8e', color: '#ccc', fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.8rem', borderRadius: '6px', textDecoration: 'none' }}>
                      Create/Join Leagues &gt;
                    </a>
                  </div>
                </div>

                {/* GW Navigation + Overall toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', gap: '1rem', background: '#2d0a5e', borderBottom: '1px solid #4a1a8e' }}>
                  <button onClick={() => gw > 1 && setGw(g => g - 1)} disabled={!gw || gw <= 1} style={{ background: 'transparent', border: 'none', color: gw > 1 ? '#f5a623' : '#4a1a8e', fontSize: '1.5rem', cursor: gw > 1 ? 'pointer' : 'not-allowed' }}>‹</button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setViewMode('gw')} style={{ background: viewMode === 'gw' ? '#f5a623' : 'transparent', color: viewMode === 'gw' ? '#1a0a2e' : '#8892b0', border: viewMode === 'gw' ? 'none' : '1px solid #4a1a8e', fontWeight: 700, fontSize: '0.85rem', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>
                      Gameweek {gw || '—'}
                    </button>
                    <button onClick={() => setViewMode('overall')} style={{ background: viewMode === 'overall' ? '#f5a623' : 'transparent', color: viewMode === 'overall' ? '#1a0a2e' : '#8892b0', border: viewMode === 'overall' ? 'none' : '1px solid #4a1a8e', fontWeight: 700, fontSize: '0.85rem', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>
                      Overall
                    </button>
                  </div>
                  <button onClick={() => gw < 38 && setGw(g => g + 1)} disabled={!gw || gw >= 38} style={{ background: 'transparent', border: 'none', color: gw < 38 ? '#f5a623' : '#4a1a8e', fontSize: '1.5rem', cursor: gw < 38 ? 'pointer' : 'not-allowed' }}>›</button>
                </div>

                {/* Winner banner */}
                {winner && (
                  <div style={{ margin: '0.75rem', background: 'linear-gradient(135deg, #f5a623, #e09510)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🏆</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a0a2e' }}>{winner.playerName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#4a3000', marginTop: '2px' }}>
                      {viewMode === 'overall' ? 'We will email you your $100 Gift Voucher Code.' : 'We will email you your $10 Gift Voucher Code.'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#4a3000', marginTop: '4px' }}>Any issues please mail <span style={{ textDecoration: 'underline' }}>vidigoals@gmail.com</span></div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1a0a2e', marginTop: '0.5rem' }}>{viewMode === 'overall' ? winner.total : winner.eventTotal}</div>
                  </div>
                )}

                {/* Standings table */}
                <div style={{ padding: '0 0.5rem' }}>
                  <div style={{ display: 'flex', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#8892b0', borderBottom: '1px solid #4a1a8e' }}>
                    <span style={{ width: '35px' }}>Pos</span>
                    <span style={{ flex: 1 }}>Player</span>
                    <span style={{ width: '50px', textAlign: 'right' }}>{viewMode === 'overall' ? 'Total' : `GW${gw || ''}`}</span>
                  </div>

                  {loadingStandings && <StatusMsg>Loading standings…</StatusMsg>}

                  {sortedStandings.map((entry, i) => (
                    <div key={entry.entry} style={{ display: 'flex', alignItems: 'center', padding: '0.7rem 0.5rem', borderBottom: '1px solid #2d1a4e' }}>
                      <span style={{ width: '35px', fontWeight: 700, fontSize: '0.85rem', color: i === 0 ? '#f5a623' : '#fff' }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#eaeaea' }}>{entry.playerName}</div>
                        <div style={{ fontSize: '0.65rem', color: '#8892b0' }}>{entry.entryName}</div>
                      </div>
                      <span style={{ width: '50px', textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: i === 0 ? '#f5a623' : '#fff' }}>
                        {viewMode === 'overall' ? entry.total : entry.eventTotal}
                      </span>
                    </div>
                  ))}

                  {!loadingStandings && sortedStandings.length === 0 && (
                    <StatusMsg>No players in the VidiGoals league yet.<br />Join with code <strong style={{ color: '#f5a623' }}>{VIDIGOALS_LEAGUE_CODE}</strong></StatusMsg>
                  )}
                </div>
              </>
            )}

            {/* ── My Leagues Tab ── */}
            {activeTab === 'myleagues' && !selectedLeague && (
              <>
                {!user && (
                  <StatusMsg>
                    Sign in to view your leagues.<br /><br />
                    <a href="/signin">Enter your FPL Manager ID →</a>
                  </StatusMsg>
                )}

                {user && loadingLeagues && <StatusMsg>Loading your leagues…</StatusMsg>}

                {user && myLeagues && (
                  <div style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>My Leagues</h2>
                      <a href="https://fantasy.premierleague.com/leagues/join" target="_blank" rel="noopener noreferrer" style={{ background: '#4a1a8e', color: '#ccc', fontSize: '0.7rem', fontWeight: 700, padding: '0.35rem 0.7rem', borderRadius: '6px', textDecoration: 'none' }}>
                        Create/Join Leagues &gt;
                      </a>
                    </div>

                    {/* Classic Leagues */}
                    {myLeagues.classic?.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8892b0', marginTop: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Classic Leagues</div>
                        {myLeagues.classic.map(league => (
                          <div key={league.id} onClick={() => openLeague(league)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.5rem', borderBottom: '1px solid #2d1a4e', cursor: 'pointer' }}>
                            <span style={{ fontSize: '0.85rem', color: '#eaeaea', fontWeight: 600 }}>{league.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8892b0' }}>{league.rank?.toLocaleString()}</span>
                              <span style={{ color: '#48bb78', fontSize: '0.7rem' }}>●</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* H2H Leagues */}
                    {myLeagues.h2h?.length > 0 && (
                      <>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8892b0', marginTop: '1rem', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Head-to-Head Leagues</div>
                        {myLeagues.h2h.map(league => (
                          <div key={league.id} onClick={() => openLeague(league)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.5rem', borderBottom: '1px solid #2d1a4e', cursor: 'pointer' }}>
                            <span style={{ fontSize: '0.85rem', color: '#eaeaea', fontWeight: 600 }}>{league.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8892b0' }}>{league.rank?.toLocaleString()}</span>
                              <span style={{ color: '#8892b0', fontSize: '0.7rem' }}>●</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── Selected League View ── */}
            {activeTab === 'myleagues' && selectedLeague && (
              <>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #4a1a8e', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button onClick={() => { setSelectedLeague(null); setLeagueStandings(null); }} style={{ background: 'transparent', border: 'none', color: '#f5a623', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{selectedLeague.name}</h2>
                </div>

                {loadingLeagueStandings && <StatusMsg>Loading standings…</StatusMsg>}

                {leagueStandings && (
                  <div style={{ padding: '0 0.5rem' }}>
                    <div style={{ display: 'flex', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#8892b0', borderBottom: '1px solid #4a1a8e' }}>
                      <span style={{ width: '35px' }}>Pos</span>
                      <span style={{ flex: 1 }}>Player</span>
                      <span style={{ width: '50px', textAlign: 'right' }}>GW</span>
                      <span style={{ width: '55px', textAlign: 'right' }}>Total</span>
                    </div>

                    {leagueStandings.standings?.map((entry, i) => (
                      <div key={entry.entry} style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 0.5rem', borderBottom: '1px solid #2d1a4e' }}>
                        <span style={{ width: '35px', fontWeight: 700, fontSize: '0.82rem', color: i === 0 ? '#f5a623' : '#fff' }}>{entry.rank}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#eaeaea' }}>{entry.playerName}</div>
                          <div style={{ fontSize: '0.62rem', color: '#8892b0' }}>{entry.entryName}</div>
                        </div>
                        <span style={{ width: '50px', textAlign: 'right', fontSize: '0.82rem', color: '#8892b0' }}>{entry.eventTotal}</span>
                        <span style={{ width: '55px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: i === 0 ? '#f5a623' : '#fff' }}>{entry.total}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Content>
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard" active={1}><NavIcon>🏆</NavIcon>Leaderboard</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes"><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
