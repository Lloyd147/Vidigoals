import { useState, useEffect } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle } from 'styled-components';
import AppShell from '../components/AppShell';
import TeamPitchView from '../components/TeamPitchView';
import PlayerOddsView from '../components/PlayerOddsView';

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

// VidiGoals League Config
const VIDIGOALS_LEAGUE_CODE = 'u282gn';
const VIDIGOALS_JOIN_URL = 'https://fantasy.premierleague.com/leagues/auto-join/u282gn';
const VIDIGOALS_LEAGUE_ID = null; // Set once league is approved
const CURRENT_GW = 38; // League starts GW38

export default function Leaderboard() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('vidigoals');
  const [standings, setStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [myLeagues, setMyLeagues] = useState(null);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [leagueStandings, setLeagueStandings] = useState(null);
  const [loadingLeagueStandings, setLoadingLeagueStandings] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState(null); // { entry, playerName, entryName }
  const [viewingPlayerPicks, setViewingPlayerPicks] = useState(null);
  const [loadingPlayerPicks, setLoadingPlayerPicks] = useState(false);
  const [viewingGw, setViewingGw] = useState(CURRENT_GW);
  const [viewingTab, setViewingTab] = useState('points'); // 'points' | 'odds'
  const [gwDropdownOpen, setGwDropdownOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  // Fetch VidiGoals league standings
  useEffect(() => {
    if (!VIDIGOALS_LEAGUE_ID) {
      setLoadingStandings(false);
      return;
    }
    setLoadingStandings(true);
    fetch(`/api/leagues?leagueId=${VIDIGOALS_LEAGUE_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStandings(data); setLoadingStandings(false); })
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

  function openLeague(league) {
    setSelectedLeague(league);
    setViewingPlayer(null);
    setLoadingLeagueStandings(true);
    const type = league.type || 'classic';
    fetch(`/api/leagues?leagueId=${league.id}&type=${type}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setLeagueStandings(data); setLoadingLeagueStandings(false); })
      .catch(() => setLoadingLeagueStandings(false));
  }

  // View another player's team
  function viewPlayerTeam(entry) {
    setViewingPlayer(entry);
    setViewingTab('points');
    setGwDropdownOpen(false);
    // Fetch without specifying GW — API will return the current active GW
    setLoadingPlayerPicks(true);
    fetch(`/api/fpl-picks?id=${entry.entry}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setViewingPlayerPicks(data);
        if (data?.gameweek) setViewingGw(data.gameweek); // Use actual current GW from API
        setLoadingPlayerPicks(false);
      })
      .catch(() => setLoadingPlayerPicks(false));
  }

  function fetchViewingPicks(entryId, gwNum) {
    setLoadingPlayerPicks(true);
    fetch(`/api/fpl-picks?id=${entryId}&gw=${gwNum}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setViewingPlayerPicks(data); setLoadingPlayerPicks(false); })
      .catch(() => setLoadingPlayerPicks(false));
  }

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  const sortedStandings = standings?.standings
    ? [...standings.standings].sort((a, b) => b.eventTotal - a.eventTotal)
    : [];

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
            <Tab active={activeTab === 'vidigoals' ? 1 : 0} onClick={() => { setActiveTab('vidigoals'); setSelectedLeague(null); setViewingPlayer(null); }}>VidiGoals</Tab>
            <Tab active={activeTab === 'myleagues' ? 1 : 0} onClick={() => { setActiveTab('myleagues'); setSelectedLeague(null); setViewingPlayer(null); }}>My Leagues</Tab>
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
                    <a href={VIDIGOALS_JOIN_URL} target="_blank" rel="noopener noreferrer" style={{ background: '#f5a623', color: '#1a0a2e', fontSize: '0.75rem', fontWeight: 700, padding: '0.4rem 0.8rem', borderRadius: '6px', textDecoration: 'none' }}>
                      Join League
                    </a>
                  </div>
                </div>

                {/* Fixed GW38 header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', background: '#2d0a5e', borderBottom: '1px solid #4a1a8e' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>Gameweek {CURRENT_GW}</span>
                </div>

                {/* Winner banner — pending */}
                <div style={{ margin: '0.75rem', background: 'linear-gradient(135deg, #f5a623, #e09510)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>🏆</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1a0a2e' }}>Pending</div>
                  <div style={{ fontSize: '0.75rem', color: '#4a3000', marginTop: '4px' }}>
                    $100 prize awarded to GW{CURRENT_GW} winner
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#4a3000', marginTop: '4px' }}>Any issues please mail <span style={{ textDecoration: 'underline' }}>vidigoals@gmail.com</span></div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1a0a2e', marginTop: '0.5rem' }}>0</div>
                </div>

                {/* Standings table */}
                <div style={{ padding: '0 0.5rem' }}>
                  <div style={{ display: 'flex', padding: '0.5rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#8892b0', borderBottom: '1px solid #4a1a8e' }}>
                    <span style={{ width: '35px' }}>Pos</span>
                    <span style={{ flex: 1 }}>Player</span>
                    <span style={{ width: '50px', textAlign: 'right' }}>GW{CURRENT_GW}</span>
                  </div>

                  {loadingStandings && <StatusMsg>Loading standings…</StatusMsg>}

                  {sortedStandings.length > 0 ? sortedStandings.map((entry, i) => (
                    <div key={entry.entry} onClick={() => viewPlayerTeam(entry)} style={{ display: 'flex', alignItems: 'center', padding: '0.7rem 0.5rem', borderBottom: '1px solid #2d1a4e', cursor: 'pointer' }}>
                      <span style={{ width: '35px', fontWeight: 700, fontSize: '0.85rem', color: i === 0 ? '#f5a623' : '#fff' }}>{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#eaeaea' }}>{entry.playerName}</div>
                        <div style={{ fontSize: '0.65rem', color: '#8892b0' }}>{entry.entryName}</div>
                      </div>
                      <span style={{ width: '50px', textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: i === 0 ? '#f5a623' : '#fff' }}>
                        {entry.eventTotal || 0}
                      </span>
                    </div>
                  )) : (
                    <StatusMsg>
                      Join the VidiGoals league to compete!<br />
                      Use code <strong style={{ color: '#f5a623' }}>{VIDIGOALS_LEAGUE_CODE}</strong> or click Join League above.
                    </StatusMsg>
                  )}
                </div>
              </>
            )}

            {/* ── My Leagues Tab ── */}
            {activeTab === 'myleagues' && !selectedLeague && !viewingPlayer && (
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
            {activeTab === 'myleagues' && selectedLeague && !viewingPlayer && (
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
                      <div key={entry.entry} onClick={() => viewPlayerTeam(entry)} style={{ display: 'flex', alignItems: 'center', padding: '0.65rem 0.5rem', borderBottom: '1px solid #2d1a4e', cursor: 'pointer' }}>
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

            {/* ── Viewing Another Player's Team ── */}
            {viewingPlayer && (
              <>
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #4a1a8e', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button onClick={() => { setViewingPlayer(null); setViewingPlayerPicks(null); setViewingGw(CURRENT_GW); setViewingTab('points'); }} style={{ background: 'transparent', border: 'none', color: '#f5a623', fontSize: '1.2rem', cursor: 'pointer' }}>←</button>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{viewingPlayer.playerName}</div>
                    <div style={{ fontSize: '0.7rem', color: '#8892b0' }}>{viewingPlayer.entryName}</div>
                  </div>
                </div>

                {/* Team Points / Player Odds tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #4a1a8e', background: '#2d0a5e' }}>
                  <button onClick={() => setViewingTab('points')} style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: viewingTab === 'points' ? '2px solid #f5a623' : '2px solid transparent', color: viewingTab === 'points' ? '#f5a623' : '#8892b0', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', cursor: 'pointer' }}>Team Points</button>
                  <button onClick={() => setViewingTab('odds')} style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: viewingTab === 'odds' ? '2px solid #f5a623' : '2px solid transparent', color: viewingTab === 'odds' ? '#f5a623' : '#8892b0', fontWeight: 700, fontSize: '0.9rem', padding: '0.75rem', cursor: 'pointer' }}>Player Odds</button>
                </div>

                {/* GW Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', gap: '1.5rem', background: '#2d0a5e', borderBottom: '1px solid #4a1a8e' }}>
                  <button onClick={() => { if (viewingGw > 1) { setViewingGw(g => g - 1); fetchViewingPicks(viewingPlayer.entry, viewingGw - 1); } }} disabled={viewingGw <= 1} style={{ background: 'transparent', border: 'none', color: viewingGw > 1 ? '#f5a623' : '#4a1a8e', fontSize: '1.5rem', cursor: viewingGw > 1 ? 'pointer' : 'not-allowed' }}>‹</button>
                  <div style={{ position: 'relative' }}>
                    <span onClick={() => setGwDropdownOpen(o => !o)} style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', minWidth: '140px', textAlign: 'center', cursor: 'pointer', display: 'inline-block' }}>
                      Gameweek {viewingGw} <span style={{ fontSize: '0.7rem', color: '#f5a623' }}>▼</span>
                    </span>
                    {gwDropdownOpen && (
                      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#2d0a5e', border: '1px solid #4a1a8e', borderRadius: '6px', zIndex: 50, marginTop: '6px', maxHeight: '200px', overflowY: 'auto', width: '140px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        {Array.from({ length: 38 }, (_, i) => i + 1).map(n => (
                          <div key={n} onClick={() => { setViewingGw(n); setGwDropdownOpen(false); fetchViewingPicks(viewingPlayer.entry, n); }} style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: n === viewingGw ? '#f5a623' : '#ccc', fontWeight: n === viewingGw ? 700 : 400, background: n === viewingGw ? 'rgba(245,166,35,0.1)' : 'transparent', cursor: 'pointer', borderBottom: '1px solid #4a1a8e' }}>
                            Gameweek {n}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { if (viewingGw < 38) { setViewingGw(g => g + 1); fetchViewingPicks(viewingPlayer.entry, viewingGw + 1); } }} disabled={viewingGw >= 38} style={{ background: 'transparent', border: 'none', color: viewingGw < 38 ? '#f5a623' : '#4a1a8e', fontSize: '1.5rem', cursor: viewingGw < 38 ? 'pointer' : 'not-allowed' }}>›</button>
                </div>

                {/* Current Round Active indicator */}
                {viewingPlayerPicks?.latestGW && viewingGw === viewingPlayerPicks.latestGW && (
                  <div style={{ textAlign: 'center', padding: '0.3rem 0', fontSize: '0.65rem', color: '#48bb78', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', background: '#2d0a5e' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#48bb78', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
                    CURRENT ROUND ACTIVE
                  </div>
                )}

                {loadingPlayerPicks && <StatusMsg>Loading team…</StatusMsg>}

                {viewingPlayerPicks && viewingTab === 'points' && (
                  <>
                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem' }}>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.5rem 0.25rem' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f5a623' }}>
                          {viewingPlayerPicks?.latestGW && viewingGw === viewingPlayerPicks.latestGW && <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#48bb78', marginRight: '4px', animation: 'pulse-dot 1.5s infinite' }} />}
                          {viewingPlayerPicks.starting?.reduce((sum, p) => sum + (p.event_points || 0) * (p.multiplier || 1), 0) || 0}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#8892b0', marginTop: '2px' }}>GW POINTS</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.5rem 0.25rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                          {viewingPlayerPicks.entry_history?.rank?.toLocaleString() || '—'}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#8892b0', marginTop: '2px' }}>GW RANK</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.5rem 0.25rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                          {viewingPlayerPicks.entry_history?.overall_rank?.toLocaleString() || '—'}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#8892b0', marginTop: '2px' }}>OVERALL RANK</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.5rem 0.25rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff' }}>
                          {viewingPlayerPicks.entry_history?.event_transfers || 0}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#8892b0', marginTop: '2px' }}>TRANSFERS</div>
                      </div>
                    </div>

                    {/* Chip badge */}
                    {viewingPlayerPicks.active_chip && (
                      <div style={{ padding: '0 0.75rem 0.5rem' }}>
                        <span style={{ display: 'inline-block', background: '#f5a623', color: '#1a0a2e', fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: '10px' }}>
                          {viewingPlayerPicks.active_chip === '3xc' ? 'Triple Captain Played' :
                           viewingPlayerPicks.active_chip === 'bboost' ? 'Bench Boost Played' :
                           viewingPlayerPicks.active_chip === 'wildcard' ? 'Wildcard Played' :
                           viewingPlayerPicks.active_chip === 'freehit' ? 'Free Hit Played' :
                           viewingPlayerPicks.active_chip.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Pitch view */}
                    <TeamPitchView picks={viewingPlayerPicks} gw={viewingGw} />
                  </>
                )}

                {viewingPlayerPicks && viewingTab === 'odds' && (
                  <PlayerOddsView picks={viewingPlayerPicks} gw={viewingGw} />
                )}
              </>
            )}
          </Content>
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard" active={1}><NavIcon>🏆</NavIcon>Leagues</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes"><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
