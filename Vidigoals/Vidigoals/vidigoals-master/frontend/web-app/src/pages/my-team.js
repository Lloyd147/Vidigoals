import { useState, useEffect } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a0a2e;
    color: #eaeaea;
    min-height: 100vh;
  }
`;

// ── Layout ────────────────────────────────────────────────────────────────────
const Wrapper = styled.div`
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a0a2e;
`;

const TopBar = styled.div`
  background: #2d0a5e;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
`;

const Logo = styled.a`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  text-decoration: none;
  span { color: #f5a623; }
`;

const LogoutBtn = styled.button`
  background: transparent;
  border: 1px solid #4a1a8e;
  color: #8892b0;
  font-size: 0.75rem;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  &:hover { color: #fc8181; border-color: #fc8181; }
`;

const TeamHeader = styled.div`
  background: #2d0a5e;
  padding: 1rem;
  border-bottom: 1px solid #4a1a8e;
`;

const TeamName = styled.h1`
  font-size: 1.4rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 0.25rem;
`;

const ManagerName = styled.div`
  font-size: 0.85rem;
  color: #8892b0;
  margin-bottom: 1rem;
`;

const GWNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const GWBtn = styled.button`
  background: transparent;
  border: none;
  color: #8892b0;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  &:hover { color: #fff; }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const GWLabel = styled.div`
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
  min-width: 120px;
  text-align: center;
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
`;

const StatBox = styled.div`
  flex: 1;
  text-align: center;
  background: rgba(255,255,255,0.05);
  border-radius: 8px;
  padding: 0.6rem 0.25rem;
`;

const StatValue = styled.div`
  font-size: ${({ large }) => large ? '1.6rem' : '1.1rem'};
  font-weight: 800;
  color: ${({ large }) => large ? '#f5a623' : '#fff'};
`;

const StatLabel = styled.div`
  font-size: 0.65rem;
  color: #8892b0;
  margin-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ChipBadge = styled.div`
  display: inline-block;
  background: #f5a623;
  color: #1a0a2e;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 0.5rem;
`;

// ── Pitch ─────────────────────────────────────────────────────────────────────
const PitchWrapper = styled.div`
  flex: 1;
  padding: 0.5rem;
`;

const Pitch = styled.div`
  background: linear-gradient(180deg, #2d7a3a 0%, #1e5c2a 50%, #2d7a3a 100%);
  border-radius: 10px;
  padding: 1rem 0.5rem;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 10%;
    right: 10%;
    height: 1px;
    background: rgba(255,255,255,0.2);
  }
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
  }
`;

const PitchRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
`;

const PlayerCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 68px;
  cursor: default;
`;

const PlayerShirt = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50% 50% 40% 40%;
  background: ${({ captain, vice }) => captain ? '#f5a623' : vice ? '#6c2eb9' : '#1a3a6e'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  position: relative;
  border: 2px solid ${({ captain, vice }) => captain ? '#f5a623' : vice ? '#9b59b6' : 'rgba(255,255,255,0.2)'};
  margin-bottom: 3px;
`;

const CaptainBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  background: #f5a623;
  color: #1a0a2e;
  font-size: 0.55rem;
  font-weight: 800;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const PlayerNameLabel = styled.div`
  font-size: 0.65rem;
  font-weight: 600;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 68px;
  background: rgba(0,0,0,0.5);
  border-radius: 3px;
  padding: 1px 3px;
`;

const PointsBadge = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: #1a0a2e;
  border-radius: 3px;
  padding: 1px 5px;
  margin-top: 2px;
`;

const BenchSection = styled.div`
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  padding: 0.75rem 0.5rem 0.5rem;
  margin-top: 0.5rem;
`;

const BenchLabel = styled.div`
  text-align: center;
  font-size: 0.7rem;
  color: #8892b0;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
`;

// ── Bottom Nav ────────────────────────────────────────────────────────────────
const BottomNav = styled.nav`
  position: sticky;
  bottom: 0;
  background: #2d0a5e;
  display: flex;
  border-top: 1px solid #4a1a8e;
  z-index: 100;
`;

const NavItem = styled.a`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.25rem;
  text-decoration: none;
  color: ${({ active }) => (active ? '#f5a623' : '#8892b0')};
  font-size: 0.65rem;
  gap: 3px;
  border-top: 2px solid ${({ active }) => (active ? '#f5a623' : 'transparent')};
  &:hover { color: #f5a623; }
`;

const NavIcon = styled.span`font-size: 1.2rem;`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.8;
  a { color: #f5a623; }
`;

// ── Group starting XI by position ─────────────────────────────────────────────
function groupByPosition(players) {
  const gkp = players.filter(p => p.element_type === 1);
  const def = players.filter(p => p.element_type === 2);
  const mid = players.filter(p => p.element_type === 3);
  const fwd = players.filter(p => p.element_type === 4);
  return [gkp, def, mid, fwd];
}

function PlayerTile({ player }) {
  const pts = player.multiplier > 1
    ? player.event_points * player.multiplier
    : player.event_points;

  return (
    <PlayerCard>
      <PlayerShirt captain={player.is_captain} vice={player.is_vice_captain}>
        {player.pos_label}
        {player.is_captain && <CaptainBadge>C</CaptainBadge>}
        {player.is_vice_captain && <CaptainBadge style={{ background: '#9b59b6' }}>V</CaptainBadge>}
      </PlayerShirt>
      <PlayerNameLabel>{player.web_name}</PlayerNameLabel>
      <PointsBadge>{pts}</PointsBadge>
    </PlayerCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyTeam() {
  const [user, setUser]       = useState(null);
  const [picks, setPicks]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [gw, setGw]           = useState(null);
  const [maxGw, setMaxGw]     = useState(38);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchPicks(user.id, gw);
  }, [user, gw]);

  async function fetchPicks(id, gameweek) {
    setLoading(true);
    setError(null);
    try {
      const url = gameweek ? `/api/fpl-picks?id=${id}&gw=${gameweek}` : `/api/fpl-picks?id=${id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPicks(data);
      if (!gw) setGw(data.gameweek);
      setMaxGw(data.gameweek);
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

  if (!user) {
    return (
      <>
        <GlobalStyle />
        <Wrapper>
          <TopBar>
            <Logo href="/">⚽ Vidi<span>Goals</span></Logo>
          </TopBar>
          <StatusMsg>
            You need to sign in to view your team.<br /><br />
            <a href="/signin">Sign in with your FPL Manager ID →</a>
          </StatusMsg>
        </Wrapper>
      </>
    );
  }

  const rows = picks ? groupByPosition(picks.starting) : [];
  const bench = picks?.bench || [];
  const history = picks?.entry_history;

  return (
    <>
      <Head>
        <title>{user.name || 'My Team'} — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <TopBar>
          <Logo href="/">⚽ Vidi<span>Goals</span></Logo>
          <LogoutBtn onClick={handleLogout}>Logout</LogoutBtn>
        </TopBar>

        <TeamHeader>
          <TeamName>{user.name || 'My Team'}</TeamName>
          <ManagerName>{user.managerName}</ManagerName>

          {/* GW navigation */}
          <GWNav>
            <GWBtn onClick={() => setGw(g => Math.max(1, (g || 1) - 1))} disabled={gw <= 1}>‹</GWBtn>
            <GWLabel>Gameweek {gw || '—'}</GWLabel>
            <GWBtn onClick={() => setGw(g => Math.min(maxGw, (g || maxGw) + 1))} disabled={gw >= maxGw}>›</GWBtn>
          </GWNav>

          {history && (
            <StatsRow>
              <StatBox>
                <StatValue>{history.points_on_bench ?? '—'}</StatValue>
                <StatLabel>Bench Pts</StatLabel>
              </StatBox>
              <StatBox large>
                <StatValue large>{history.points ?? '—'}</StatValue>
                <StatLabel>GW Points</StatLabel>
              </StatBox>
              <StatBox>
                <StatValue>{history.rank?.toLocaleString() ?? '—'}</StatValue>
                <StatLabel>GW Rank</StatLabel>
              </StatBox>
              <StatBox>
                <StatValue>{history.event_transfers ?? '—'}</StatValue>
                <StatLabel>Transfers</StatLabel>
              </StatBox>
            </StatsRow>
          )}

          {picks?.active_chip && (
            <ChipBadge>{picks.active_chip.replace(/_/g, ' ').toUpperCase()}</ChipBadge>
          )}
        </TeamHeader>

        <PitchWrapper>
          {loading && <StatusMsg>Loading team…</StatusMsg>}
          {error && <StatusMsg>Could not load team.<br />{error}</StatusMsg>}

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

        <BottomNav>
          <NavItem href="/">
            <NavIcon>⚽</NavIcon>Goals
          </NavItem>
          <NavItem href="/my-team" active={1}>
            <NavIcon>👕</NavIcon>My Team
          </NavItem>
          <NavItem href="/signin">
            <NavIcon>🏆</NavIcon>Leaderboard
          </NavItem>
          <NavItem href="#">
            <NavIcon>📋</NavIcon>Matches
          </NavItem>
          <NavItem href="#">
            <NavIcon>⚙️</NavIcon>Settings
          </NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
