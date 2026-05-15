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

                  return (
                    <FixtureRow key={match.id}>
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
