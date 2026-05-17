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

const Content = styled.div`
  flex: 1;
  padding: 1rem;
  padding-bottom: 70px;
`;

const PageTitle = styled.h1`
  font-size: 1.1rem;
  font-weight: 700;
  color: #f5a623;
  text-align: center;
  margin-bottom: 1rem;
`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.6;
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  return (
    <>
      <Head>
        <title>Price Changes — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="price-changes" onLogout={handleLogout}>
          <Content>
            <PageTitle>📈 Price Change Predictions</PageTitle>
            <StatusMsg>
              Price change predictions coming soon.<br />
              Track which players are rising and falling in price.
            </StatusMsg>
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
