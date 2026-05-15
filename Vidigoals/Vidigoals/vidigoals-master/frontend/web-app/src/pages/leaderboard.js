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

const ComingSoon = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
`;

const Icon = styled.div`font-size: 3rem; margin-bottom: 1rem;`;
const Title = styled.h1`font-size: 1.5rem; color: #f5a623; margin-bottom: 0.5rem;`;
const Desc = styled.p`font-size: 0.9rem; color: #8892b0; line-height: 1.6;`;

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

export default function Leaderboard() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    try { const s = localStorage.getItem('vidigoals_user'); if (s) setUser(JSON.parse(s)); } catch {}
  }, []);
  const handleLogout = () => { localStorage.removeItem('vidigoals_user'); setUser(null); };

  return (
    <>
      <Head><title>Leaderboard — VidiGoals</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="leaderboard" onLogout={handleLogout}>
          <ComingSoon>
            <Icon>🏆</Icon>
            <Title>Leaderboard</Title>
            <Desc>Coming soon! Compare your FPL performance with friends and other VidiGoals users.</Desc>
          </ComingSoon>
        </AppShell>
        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard" active={1}><NavIcon>🏆</NavIcon>Leaderboard</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/settings"><NavIcon>⚙️</NavIcon>Settings</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
