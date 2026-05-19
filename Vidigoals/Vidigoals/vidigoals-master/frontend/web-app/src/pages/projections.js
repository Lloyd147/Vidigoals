import { useState, useEffect } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle } from 'styled-components';
import AppShell from '../components/AppShell';
import TeamPitchView from '../components/TeamPitchView';

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

export default function Projections() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
      else setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => {
    fetch('/api/projections')
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(typeof e === 'string' ? e : e.message); setLoading(false); });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  // Difficulty colour
  function fdrColor(d) {
    if (d <= 2) return '#48bb78';
    if (d === 3) return '#8892b0';
    if (d === 4) return '#f5a623';
    return '#fc8181';
  }

  return (
    <>
      <Head>
        <title>Player Projections — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="projections" onLogout={handleLogout}>
          <Content>
            {loading && <StatusMsg>Calculating projections…</StatusMsg>}
            {error && <StatusMsg>Could not load projections.<br />{error}</StatusMsg>}

            {data && (
              <>
                {/* Header */}
                <div style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #4a1a8e' }}>
                  <div style={{ fontSize: '0.7rem', color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gameweek {data.gameweek} Projected Best XI</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f5a623', marginTop: '0.25rem' }}>{data.totalProjected} pts</div>
                  <div style={{ fontSize: '0.65rem', color: '#8892b0', marginTop: '0.25rem' }}>Based on fixture difficulty, form, odds & availability</div>
                </div>

                {/* Pitch view with projected points */}
                <TeamPitchView picks={{ starting: data.starting.map(p => ({
                  ...p,
                  element: p.id,
                  element_type: p.position,
                  web_name: p.name,
                  team_id: p.teamId,
                  is_captain: false,
                  is_vice_captain: false,
                  multiplier: 1,
                  event_points: p.projectedPoints,
                  fixture: p.fixture,
                  fixtureLive: false,
                })), bench: [] }} gw={data.gameweek} />

                {/* Detailed breakdown table */}
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8892b0', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Projection Breakdown</div>
                  <div style={{ display: 'flex', padding: '0.4rem 0.5rem', fontSize: '0.6rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #4a1a8e' }}>
                    <span style={{ width: '30px' }}>Pos</span>
                    <span style={{ flex: 1 }}>Player</span>
                    <span style={{ width: '55px', textAlign: 'center' }}>Fixture</span>
                    <span style={{ width: '35px', textAlign: 'center' }}>FDR</span>
                    <span style={{ width: '35px', textAlign: 'center' }}>Form</span>
                    <span style={{ width: '45px', textAlign: 'right' }}>Proj</span>
                  </div>
                  {data.starting.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #2d1a4e' }}>
                      <span style={{ width: '30px', fontSize: '0.65rem', color: '#8892b0', fontWeight: 700 }}>{p.posLabel}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#eaeaea' }}>{p.name}</div>
                        <div style={{ fontSize: '0.58rem', color: '#8892b0' }}>{p.teamShort}</div>
                      </div>
                      <span style={{ width: '55px', textAlign: 'center', fontSize: '0.68rem', color: '#8892b0' }}>{p.fixture}</span>
                      <span style={{ width: '35px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: fdrColor(p.difficulty) }}>{p.difficulty}</span>
                      <span style={{ width: '35px', textAlign: 'center', fontSize: '0.7rem', color: '#8892b0' }}>{p.form}</span>
                      <span style={{ width: '45px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: '#f5a623' }}>{p.projectedPoints}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Content>
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard"><NavIcon>🏆</NavIcon>Leagues</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes"><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
