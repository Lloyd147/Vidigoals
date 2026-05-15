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

// ── GW Navigation ─────────────────────────────────────────────────────────────
const GWHeader = styled.div`
  background: #2d0a5e;
  padding: 1rem;
  text-align: center;
  border-bottom: 1px solid #4a1a8e;
`;

const GWNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
`;

const GWBtn = styled.button`
  background: transparent;
  border: none;
  color: ${({ disabled }) => disabled ? '#4a1a8e' : '#f5a623'};
  font-size: 1.5rem;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  line-height: 1;
  padding: 0.25rem 0.5rem;
  &:hover:not(:disabled) { color: #fff; }
`;

const GWLabel = styled.div`
  font-weight: 700;
  font-size: 1.1rem;
  color: #fff;
  min-width: 160px;
  text-align: center;
`;

// ── Fixtures List ─────────────────────────────────────────────────────────────
const FixturesWrapper = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
`;

const DateHeader = styled.div`
  padding: 0.6rem 1rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #8892b0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(45, 10, 94, 0.4);
`;

const FixtureRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #2d1a4e;
  gap: 0.5rem;
  cursor: pointer;
  transition: background 0.15s;
  &:hover { background: rgba(108,46,185,0.15); }
`;

const ExpandedDetails = styled.div`
  padding: 0.75rem 1rem 1rem;
  background: rgba(45, 10, 94, 0.3);
  border-bottom: 1px solid #4a1a8e;
`;

const TabRow = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 0.75rem;
  border-bottom: 1px solid #4a1a8e;
`;

const Tab = styled.button`
  flex: 1;
  background: transparent;
  border: none;
  color: ${({ active }) => active ? '#f5a623' : '#8892b0'};
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.5rem 0.25rem;
  cursor: pointer;
  border-bottom: 2px solid ${({ active }) => active ? '#f5a623' : 'transparent'};
  &:hover { color: #f5a623; }
`;

const DetailSection = styled.div`
  margin-bottom: 0.75rem;
  &:last-child { margin-bottom: 0; }
`;

const DetailTitle = styled.div`
  font-size: 0.72rem;
  font-weight: 700;
  color: #f5a623;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.4rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #4a1a8e;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.78rem;
  color: #ccc;
`;

const DetailHome = styled.span`
  text-align: left;
  flex: 1;
`;

const DetailAway = styled.span`
  text-align: right;
  flex: 1;
`;

const StatRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.4rem 0;
  border-bottom: 1px solid rgba(74, 26, 142, 0.3);
`;

const StatValue = styled.span`
  width: 50px;
  text-align: ${({ align }) => align || 'center'};
  font-size: 0.82rem;
  font-weight: 700;
  color: #fff;
`;

const StatLabel = styled.span`
  flex: 1;
  text-align: center;
  font-size: 0.72rem;
  color: #8892b0;
`;

const BonusRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.2rem 0;
  font-size: 0.78rem;
  color: #ccc;
`;

const BonusValue = styled.span`
  color: #f5a623;
  font-weight: 700;
  margin-left: 4px;
`;

const LoadingDetail = styled.div`
  text-align: center;
  padding: 0.75rem;
  font-size: 0.8rem;
  color: #8892b0;
`;

const TeamSection = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  ${({ align }) => align === 'right' && 'flex-direction: row-reverse;'}
`;

const TeamName = styled.span`
  font-size: 0.82rem;
  font-weight: 600;
  color: #eaeaea;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
`;

const TeamLogo = styled.img`
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
`;

const ScoreBox = styled.div`
  min-width: 60px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: ${({ finished }) => finished ? '#fff' : '#f5a623'};
  background: ${({ finished }) => finished ? 'rgba(255,255,255,0.08)' : 'transparent'};
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.6;
`;

// ── Bottom Nav ────────────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Matches() {
  const [user, setUser]         = useState(null);
  const [fixtures, setFixtures] = useState({});
  const [round, setRound]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [expanded, setExpanded] = useState(null); // fixture id
  const [details, setDetails]   = useState({});   // { [id]: data }
  const [detailLoading, setDetailLoading] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'stats'

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    fetchFixtures(round);
  }, [round]);

  async function fetchFixtures(gw) {
    setLoading(true);
    setError(null);
    setExpanded(null);
    try {
      const url = gw ? `/api/fixtures?round=${gw}` : '/api/fixtures';
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFixtures(data.fixtures || {});
      if (!round && data.round) setRound(data.round);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(match) {
    const isFinished = ['FT', 'AET', 'PEN'].includes(match.status);
    if (!isFinished) return; // Only expand finished matches

    if (expanded === match.id) {
      setExpanded(null);
      return;
    }

    setExpanded(match.id);

    // Fetch details if not cached
    if (!details[match.id]) {
      setDetailLoading(match.id);
      try {
        const res = await fetch(`/api/match-details?fixtureId=${match.id}`);
        const data = await res.json();
        if (!data.error) {
          setDetails(prev => ({ ...prev, [match.id]: data }));
        }
      } catch {}
      setDetailLoading(null);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  const canGoBack = round > 1;
  const canGoForward = round < 38;

  return (
    <>
      <Head>
        <title>Matches — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="matches" onLogout={handleLogout}>
          <GWHeader>
            <GWNav>
              <GWBtn
                onClick={() => canGoBack && setRound(r => r - 1)}
                disabled={!canGoBack}
              >‹</GWBtn>
              <GWLabel>Gameweek {round || '—'}</GWLabel>
              <GWBtn
                onClick={() => canGoForward && setRound(r => r + 1)}
                disabled={!canGoForward}
              >›</GWBtn>
            </GWNav>
          </GWHeader>

          <FixturesWrapper>
            {loading && <StatusMsg>Loading fixtures…</StatusMsg>}
            {error && <StatusMsg>Could not load fixtures.<br />{error}</StatusMsg>}

            {!loading && !error && Object.keys(fixtures).length === 0 && (
              <StatusMsg>No fixtures found for this gameweek.</StatusMsg>
            )}

            {!loading && !error && Object.entries(fixtures).map(([date, matches]) => (
              <div key={date}>
                <DateHeader>{date}</DateHeader>
                {matches.map(match => {
                  const isFinished = ['FT', 'AET', 'PEN'].includes(match.status);
                  const isLive = ['1H', '2H', 'HT', 'ET'].includes(match.status);
                  const isExpanded = expanded === match.id;
                  const matchDetails = details[match.id];

                  return (
                    <div key={match.id}>
                      <FixtureRow onClick={() => toggleExpand(match)}>
                        <TeamSection align="right">
                          <TeamName>{match.home.name}</TeamName>
                          {match.home.logo && (
                            <TeamLogo
                              src={match.home.logo}
                              alt={match.home.name}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          )}
                        </TeamSection>

                        <ScoreBox finished={isFinished || isLive}>
                          {isFinished || isLive
                            ? `${match.home.score ?? 0} - ${match.away.score ?? 0}`
                            : match.time
                          }
                        </ScoreBox>

                        <TeamSection>
                          {match.away.logo && (
                            <TeamLogo
                              src={match.away.logo}
                              alt={match.away.name}
                              onError={e => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <TeamName>{match.away.name}</TeamName>
                        </TeamSection>
                      </FixtureRow>

                      {isExpanded && (
                        <ExpandedDetails>
                          {detailLoading === match.id && (
                            <LoadingDetail>Loading match details…</LoadingDetail>
                          )}

                          {matchDetails && (
                            <>
                              <TabRow>
                                <Tab active={activeTab === 'details'} onClick={() => setActiveTab('details')}>Match Details</Tab>
                                <Tab active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>Match Stats</Tab>
                              </TabRow>

                              {activeTab === 'details' && (
                                <>
                                  {/* Goals */}
                                  {(matchDetails.goals.home.length > 0 || matchDetails.goals.away.length > 0) && (
                                    <DetailSection>
                                      <DetailTitle>Goals Scored</DetailTitle>
                                      {Array.from({ length: Math.max(matchDetails.goals.home.length, matchDetails.goals.away.length) }).map((_, i) => (
                                        <DetailRow key={`goal-${i}`}>
                                          <DetailHome>{matchDetails.goals.home[i] ? `${matchDetails.goals.home[i].player} (${matchDetails.goals.home[i].minute})` : ''}</DetailHome>
                                          <DetailAway>{matchDetails.goals.away[i] ? `${matchDetails.goals.away[i].player} (${matchDetails.goals.away[i].minute})` : ''}</DetailAway>
                                        </DetailRow>
                                      ))}
                                    </DetailSection>
                                  )}

                                  {/* Assists */}
                                  {(matchDetails.assists.home.length > 0 || matchDetails.assists.away.length > 0) && (
                                    <DetailSection>
                                      <DetailTitle>Assists</DetailTitle>
                                      {Array.from({ length: Math.max(matchDetails.assists.home.length, matchDetails.assists.away.length) }).map((_, i) => (
                                        <DetailRow key={`assist-${i}`}>
                                          <DetailHome>{matchDetails.assists.home[i]?.player || ''}</DetailHome>
                                          <DetailAway>{matchDetails.assists.away[i]?.player || ''}</DetailAway>
                                        </DetailRow>
                                      ))}
                                    </DetailSection>
                                  )}

                                  {/* Yellow Cards */}
                                  {(matchDetails.yellowCards.home.length > 0 || matchDetails.yellowCards.away.length > 0) && (
                                    <DetailSection>
                                      <DetailTitle>Yellow Cards</DetailTitle>
                                      {Array.from({ length: Math.max(matchDetails.yellowCards.home.length, matchDetails.yellowCards.away.length) }).map((_, i) => (
                                        <DetailRow key={`yc-${i}`}>
                                          <DetailHome>{matchDetails.yellowCards.home[i]?.player || ''}</DetailHome>
                                          <DetailAway>{matchDetails.yellowCards.away[i]?.player || ''}</DetailAway>
                                        </DetailRow>
                                      ))}
                                    </DetailSection>
                                  )}

                                  {/* Red Cards */}
                                  {(matchDetails.redCards.home.length > 0 || matchDetails.redCards.away.length > 0) && (
                                    <DetailSection>
                                      <DetailTitle>Red Cards</DetailTitle>
                                      {Array.from({ length: Math.max(matchDetails.redCards.home.length, matchDetails.redCards.away.length) }).map((_, i) => (
                                        <DetailRow key={`rc-${i}`}>
                                          <DetailHome>{matchDetails.redCards.home[i]?.player || ''}</DetailHome>
                                          <DetailAway>{matchDetails.redCards.away[i]?.player || ''}</DetailAway>
                                        </DetailRow>
                                      ))}
                                    </DetailSection>
                                  )}

                                  {/* Saves */}
                                  {(matchDetails.saves.home > 0 || matchDetails.saves.away > 0) && (
                                    <DetailSection>
                                      <DetailTitle>Saves</DetailTitle>
                                      <DetailRow>
                                        <DetailHome>{matchDetails.saves.home || 0}</DetailHome>
                                        <DetailAway>{matchDetails.saves.away || 0}</DetailAway>
                                      </DetailRow>
                                    </DetailSection>
                                  )}

                                  {/* Bonus Points */}
                                  {(matchDetails.bonus.home.length > 0 || matchDetails.bonus.away.length > 0) && (
                                    <DetailSection>
                                      <DetailTitle>Bonus Points</DetailTitle>
                                      {Array.from({ length: Math.max(matchDetails.bonus.home.length, matchDetails.bonus.away.length) }).map((_, i) => (
                                        <BonusRow key={`bonus-${i}`}>
                                          <DetailHome>
                                            {matchDetails.bonus.home[i] ? <>{matchDetails.bonus.home[i].player}<BonusValue>({matchDetails.bonus.home[i].value})</BonusValue></> : ''}
                                          </DetailHome>
                                          <DetailAway>
                                            {matchDetails.bonus.away[i] ? <>{matchDetails.bonus.away[i].player}<BonusValue>({matchDetails.bonus.away[i].value})</BonusValue></> : ''}
                                          </DetailAway>
                                        </BonusRow>
                                      ))}
                                    </DetailSection>
                                  )}
                                </>
                              )}

                              {activeTab === 'stats' && matchDetails.stats && (
                                <DetailSection>
                                  {matchDetails.stats.map((stat, i) => (
                                    <StatRow key={i}>
                                      <StatValue align="right">{stat.home}</StatValue>
                                      <StatLabel>{stat.label}</StatLabel>
                                      <StatValue align="left">{stat.away}</StatValue>
                                    </StatRow>
                                  ))}
                                </DetailSection>
                              )}
                            </>
                          )}

                          {!matchDetails && !detailLoading && (
                            <LoadingDetail>No details available</LoadingDetail>
                          )}
                        </ExpandedDetails>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </FixturesWrapper>
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="#"><NavIcon>🏆</NavIcon>Leaderboard</NavItem>
          <NavItem href="/matches" active={1}><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="#"><NavIcon>⚙️</NavIcon>Settings</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
