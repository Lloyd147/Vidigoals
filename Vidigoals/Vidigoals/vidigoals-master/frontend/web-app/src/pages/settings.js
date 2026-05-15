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
  overflow-y: auto;
`;

const SectionTitle = styled.h2`
  font-size: 1.1rem;
  font-weight: 700;
  color: #f5a623;
  margin-bottom: 1rem;
  margin-top: ${({ first }) => first ? '0' : '1.5rem'};
`;

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0;
  border-bottom: 1px solid #2d1a4e;
`;

const ToggleLabel = styled.span`
  font-size: 0.9rem;
  color: #ccc;
`;

const Toggle = styled.button`
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: ${({ on }) => (on ? '#f5a623' : '#4a1a8e')};
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  &::after {
    content: '';
    position: absolute;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #fff;
    top: 3px;
    left: ${({ on }) => (on ? '23px' : '3px')};
    transition: left 0.2s;
  }
`;

const TCSection = styled.div`
  margin-top: 2rem;
  border-top: 1px solid #2d1a4e;
  padding-top: 1rem;
`;

const TCHeader = styled.button`
  background: transparent;
  border: none;
  color: #8892b0;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0;
  &:hover { color: #f5a623; }
`;

const TCArrow = styled.span`
  transition: transform 0.2s;
  transform: ${({ open }) => open ? 'rotate(90deg)' : 'rotate(0deg)'};
`;

const TCContent = styled.div`
  padding: 1rem 0;
  font-size: 0.78rem;
  color: #8892b0;
  line-height: 1.8;
  p { margin-bottom: 0.75rem; }
  strong { color: #ccc; }
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

const DEFAULT_PREFS = {
  showGoals: true,
  showCards: true,
  showSubs: false,
  showHtFt: true,
  showPenMiss: true,
  showPenSave: true,
};

export default function Settings() {
  const [user, setUser] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [tcOpen, setTcOpen] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem('vidigoals_user');
      if (s) setUser(JSON.parse(s));
      const p = localStorage.getItem('vidigoals_prefs');
      if (p) setPrefs(JSON.parse(p));
    } catch {}
  }, []);

  function togglePref(key) {
    setPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('vidigoals_prefs', JSON.stringify(updated));
      return updated;
    });
  }

  const handleLogout = () => { localStorage.removeItem('vidigoals_user'); setUser(null); };

  return (
    <>
      <Head><title>Settings — VidiGoals</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="settings" onLogout={handleLogout}>
          <Content>
            <SectionTitle first>Notification Preferences</SectionTitle>

            <ToggleRow>
              <ToggleLabel>⚽ Show Goals</ToggleLabel>
              <Toggle on={prefs.showGoals} onClick={() => togglePref('showGoals')} />
            </ToggleRow>

            <ToggleRow>
              <ToggleLabel>🟨 Show Cards</ToggleLabel>
              <Toggle on={prefs.showCards} onClick={() => togglePref('showCards')} />
            </ToggleRow>

            <ToggleRow>
              <ToggleLabel>🔄 Show Substitutions</ToggleLabel>
              <Toggle on={prefs.showSubs} onClick={() => togglePref('showSubs')} />
            </ToggleRow>

            <ToggleRow>
              <ToggleLabel>⏱️ Show HT & FT Scores</ToggleLabel>
              <Toggle on={prefs.showHtFt} onClick={() => togglePref('showHtFt')} />
            </ToggleRow>

            <ToggleRow>
              <ToggleLabel>❌ Show Penalty Misses</ToggleLabel>
              <Toggle on={prefs.showPenMiss} onClick={() => togglePref('showPenMiss')} />
            </ToggleRow>

            <ToggleRow>
              <ToggleLabel>🧤 Show Penalty Saves</ToggleLabel>
              <Toggle on={prefs.showPenSave} onClick={() => togglePref('showPenSave')} />
            </ToggleRow>

            <TCSection>
              <TCHeader onClick={() => setTcOpen(!tcOpen)}>
                <TCArrow open={tcOpen}>▶</TCArrow>
                Terms & Conditions
              </TCHeader>

              {tcOpen && (
                <TCContent>
                  <p><strong>VidiGoals — Terms of Use</strong></p>
                  <p>By using VidiGoals, you agree to the following terms and conditions. Please read them carefully.</p>
                  <p><strong>1. Accuracy of Information</strong><br />
                  VidiGoals provides live football scores, statistics, and Fantasy Premier League data sourced from third-party APIs. While we strive for accuracy, scores and statistics may not always be 100% accurate or up-to-date. VidiGoals is not responsible for any discrepancies between the data displayed and official results.</p>
                  <p><strong>2. Data Sources</strong><br />
                  Match data is provided by API-Football. Fantasy Premier League data is sourced from the official FPL API. Team logos and badges are the property of their respective clubs and are used for informational purposes only.</p>
                  <p><strong>3. User Accounts</strong><br />
                  When you sign in with your FPL Manager ID, we store this locally on your device. We do not collect, store, or transmit your FPL credentials to any server. Your Manager ID is used solely to fetch your publicly available team data.</p>
                  <p><strong>4. Acceptable Use</strong><br />
                  You agree not to misuse the service, attempt to access data beyond what is publicly available, or use automated tools to scrape or overload the service.</p>
                  <p><strong>5. Intellectual Property</strong><br />
                  The Premier League, Fantasy Premier League, and all associated trademarks are the property of the Football Association Premier League Limited. VidiGoals is an independent project and is not affiliated with, endorsed by, or connected to the Premier League or FPL.</p>
                  <p><strong>6. Limitation of Liability</strong><br />
                  VidiGoals is provided "as is" without warranty of any kind. We are not liable for any losses or damages arising from your use of the service, including but not limited to decisions made based on the data displayed.</p>
                  <p><strong>7. Changes to Terms</strong><br />
                  We reserve the right to update these terms at any time. Continued use of VidiGoals after changes constitutes acceptance of the updated terms.</p>
                  <p><strong>8. Privacy</strong><br />
                  VidiGoals does not use cookies for tracking. All user preferences are stored locally on your device. We do not collect personal data beyond what is necessary to display your FPL team information.</p>
                  <p>Last updated: May 2026</p>
                </TCContent>
              )}
            </TCSection>
          </Content>
        </AppShell>

        <BottomNav>
          <NavItem href="/"><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard"><NavIcon>🏆</NavIcon>Leaderboard</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/settings" active={1}><NavIcon>⚙️</NavIcon>Settings</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}
