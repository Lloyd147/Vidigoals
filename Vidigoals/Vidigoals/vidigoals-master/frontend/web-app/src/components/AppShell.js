/**
 * AppShell — shared top header + slide-out menu used on every page.
 *
 * Shows:
 *  - Hamburger menu (top left)
 *  - Logo (centered)
 *  - Logout button (top right, when logged in)
 *  - User bar: "Hello [name]" | time/date | View Team OR View Goals button
 *  - Points bar: GW Points | Overall Points (when logged in)
 *  - Slide-out menu with: Notifications toggle, Pages, Settings links
 */
import { useState, useEffect } from 'react';
import styled from 'styled-components';

const TopBar = styled.div`
  background: #2d0a5e;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
`;

const MenuBtn = styled.button`
  position: absolute;
  left: 1rem;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.3rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  &:hover { color: #f5a623; }
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
  position: absolute;
  right: 1rem;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.3);
  color: #ccc;
  font-size: 0.8rem;
  padding: 0.35rem 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  &:hover { color: #fc8181; border-color: #fc8181; }
`;

const UserBar = styled.div`
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #2d1a4e;
`;

const UserInfo = styled.div`
  div:first-child { font-weight: 700; font-size: 0.95rem; }
  div:last-child  { font-size: 0.78rem; color: #8892b0; margin-top: 2px; }
`;

const LiveDot = styled.span`
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #48bb78;
  margin-right: 5px;
  animation: pulse 1.5s infinite;
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
`;

const NavBtn = styled.a`
  background: #f5a623;
  color: #1a0a2e;
  font-weight: 700;
  font-size: 0.82rem;
  padding: 0.45rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: #e09510; }
`;

const PointsBar = styled.div`
  padding: 0.55rem 1rem;
  display: flex;
  gap: 1.5rem;
  border-bottom: 1px solid #2d1a4e;
  background: rgba(108,46,185,0.12);
  font-size: 0.85rem;
  color: #8892b0;
  span { color: #f5a623; font-weight: 700; }
`;

// ── Menu Overlay & Panel ──────────────────────────────────────────────────────
const MenuOverlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  z-index: 200;
  opacity: ${({ open }) => open ? 1 : 0};
  pointer-events: ${({ open }) => open ? 'auto' : 'none'};
  transition: opacity 0.2s;
`;

const MenuPanel = styled.div`
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 280px;
  background: #1a0a2e;
  z-index: 201;
  transform: ${({ open }) => open ? 'translateX(0)' : 'translateX(-100%)'};
  transition: transform 0.25s ease;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #4a1a8e;
`;

const MenuHeader = styled.div`
  padding: 1.2rem 1.2rem 1rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: #fff;
  border-bottom: 1px solid #2d1a4e;
`;

const MenuSection = styled.div`
  padding: 1rem 1.2rem;
  border-bottom: 1px solid #2d1a4e;
`;

const MenuSectionTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #8892b0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.6rem;
`;

const MenuToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
`;

const MenuToggleLabel = styled.span`
  font-size: 0.88rem;
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

const MenuLink = styled.a`
  display: block;
  padding: 0.6rem 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: ${({ active }) => active ? '#f5a623' : '#eaeaea'};
  text-decoration: none;
  &:hover { color: #f5a623; }
`;

const MenuSmallLink = styled.a`
  display: block;
  padding: 0.4rem 0;
  font-size: 0.82rem;
  color: #8892b0;
  text-decoration: none;
  &:hover { color: #f5a623; }
`;

const AccordionWrapper = styled.div`
  border-bottom: 1px solid rgba(74, 26, 142, 0.3);
`;

const AccordionHeader = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: transparent;
  border: none;
  color: #8892b0;
  font-size: 0.85rem;
  padding: 0.6rem 0;
  cursor: pointer;
  text-align: left;
  &:hover { color: #f5a623; }
`;

const AccordionArrow = styled.span`
  font-size: 0.7rem;
  transition: transform 0.2s;
  transform: ${({ open }) => open ? 'rotate(90deg)' : 'rotate(0deg)'};
`;

const AccordionContent = styled.div`
  padding: 0 0 0.75rem;
  font-size: 0.75rem;
  color: #8892b0;
  line-height: 1.7;
`;

function MenuAccordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <AccordionWrapper>
      <AccordionHeader onClick={() => setOpen(!open)}>
        {title}
        <AccordionArrow open={open}>▶</AccordionArrow>
      </AccordionHeader>
      {open && <AccordionContent>{children}</AccordionContent>}
    </AccordionWrapper>
  );
}

export default function AppShell({ user, page, isLive, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [livePoints, setLivePoints] = useState({ gw: null, overall: null });

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const teamName = user?.name || user?.managerName || null;

  // Fetch live GW points by calculating from picks (most reliable method)
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/fpl-picks?id=${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(picksData => {
        if (picksData?.starting) {
          const hits = picksData.entry_history?.event_transfers_cost || 0;
          const total = picksData.starting.reduce((sum, p) =>
            sum + (p.event_points || 0) * (p.multiplier || 1), 0) - hits;
          if (total > 0) {
            setLivePoints(prev => ({ ...prev, gw: total }));
          }
          // Use entry_history overall_rank's associated overall points if available
          // entry_history.total_points = overall points INCLUDING this GW
          if (picksData.entry_history?.total_points) {
            setLivePoints(prev => ({ ...prev, overall: picksData.entry_history.total_points }));
          }
        }
      })
      .catch(() => {});
  }, [user?.id]);

  return (
    <>
      {/* ── Slide-out Menu ── */}
      <MenuOverlay open={menuOpen} onClick={() => setMenuOpen(false)} />
      <MenuPanel open={menuOpen}>
        <MenuHeader>MENU</MenuHeader>

        <MenuSection>
          <MenuSectionTitle>Notifications</MenuSectionTitle>
          <MenuToggleRow>
            <MenuToggleLabel>Push Notifications</MenuToggleLabel>
            <Toggle on={false} onClick={() => {}} />
          </MenuToggleRow>
        </MenuSection>

        <MenuSection>
          <MenuSectionTitle>Pages</MenuSectionTitle>
          <MenuLink href="/" active={page === 'feed' ? 1 : 0}>FPL Goal Feed</MenuLink>
          <MenuLink href={user ? '/my-team?tab=points' : '/signin'} active={page === 'my-team' ? 1 : 0}>My Team Points</MenuLink>
          <MenuLink href={user ? '/my-team?tab=odds' : '/signin'} active={0}>My Player Odds</MenuLink>
          <MenuLink href="/projections" active={page === 'projections' ? 1 : 0}>Player Projections</MenuLink>
          <MenuLink href="/leaderboard" active={page === 'leaderboard' ? 1 : 0}>VidiGoals Leaderboard</MenuLink>
          <MenuLink href="/leaderboard?tab=myleagues" active={0}>My Leagues</MenuLink>
          <MenuLink href="/matches" active={page === 'matches' ? 1 : 0}>Matches</MenuLink>
          <MenuLink href="/price-changes" active={page === 'price-changes' ? 1 : 0}>Player Price Changes</MenuLink>
        </MenuSection>

        <MenuSection>
          <MenuSectionTitle>Settings</MenuSectionTitle>
          <MenuAccordion title="About VidiGoals">
            VidiGoals is the go-to companion app for Fantasy Premier League managers who want to stay on top of everything happening in the Premier League.<br /><br />
            <strong>Live Goal Feed</strong><br />
            Get instant alerts for every Premier League goal, card, substitution, and penalty as they happen. See running scores, assist providers, and FPL points awarded in real time.<br /><br />
            <strong>My Team</strong><br />
            View your FPL team on a pitch with player shirts, live points, captain badges, and fixture info. Track your gameweek score as it updates during matches. Navigate through every gameweek to review past performance.<br /><br />
            <strong>Player Odds</strong><br />
            See betting odds for your players across markets like Anytime Goalscorer, First Goalscorer, Assists, and Cards. Tap the odds to go straight to the bookmaker. After matches, see whether your players scored, assisted, or picked up cards.<br /><br />
            <strong>Price Changes</strong><br />
            Track which players are rising and falling in price. See progress bars showing how close each player is to a price change, their current speed of movement, and estimated change time.<br /><br />
            <strong>Matches</strong><br />
            Browse fixtures by gameweek with live scores, match stats, lineups, bonus points, and defensive contribution data. Predicted lineups shown when official ones are not yet available.<br /><br />
            <strong>Leagues</strong><br />
            Join the VidiGoals league to compete for weekly prizes. View all your FPL leagues, see standings, and check any manager's team with full pitch view and player odds.<br /><br />
            <strong>Multi-Country Support</strong><br />
            VidiGoals detects your location and shows odds from bookmakers available in your country with links to the correct regional site.<br /><br />
            Built for FPL managers who want everything in one place — scores, points, odds, prices, and leagues — without switching between multiple apps.
          </MenuAccordion>
          <MenuAccordion title="FAQ">
            <strong>What is VidiGoals?</strong><br />
            VidiGoals is a live FPL companion app that brings you real-time Premier League updates, player statistics, and tools to help you manage your Fantasy Premier League team.<br /><br />
            <strong>What does VidiGoals offer?</strong><br />
            Live goal alerts, FPL points tracking, team management with pitch view, player betting odds from bookmakers, price change predictions, match statistics, lineups, and league standings.<br /><br />
            <strong>What are player price changes?</strong><br />
            FPL player prices change daily based on transfer activity. If many managers buy a player, their price rises. If many sell, it falls. Our Price Changes page predicts which players are likely to rise or fall next.<br /><br />
            <strong>What are player odds?</strong><br />
            Player odds show the bookmaker prices for various markets like Anytime Goalscorer, First Goalscorer, Assists, and Cards. These help you see which players bookies think are most likely to score or get involved.<br /><br />
            <strong>What are bonus points?</strong><br />
            FPL awards 3, 2, and 1 bonus points to the top performers in each match. These are calculated using the Bonus Points System (BPS) which scores players based on actions like goals, assists, tackles, and more. Bonus points are confirmed after each match.
          </MenuAccordion>
          <MenuAccordion title="Contact Us">
            Email: vidigoals@gmail.com
          </MenuAccordion>
          <MenuAccordion title="Terms & Conditions">
            <strong>1. Acceptance of Terms</strong><br />
            By accessing or using VidiGoals ("the Service"), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the Service.<br /><br />

            <strong>2. User Accounts & Display Name</strong><br />
            By signing in with your FPL Manager ID, you consent to your team name and manager name being publicly displayed on VidiGoals, including but not limited to league standings, leaderboards, and competition results. You are responsible for ensuring your display name is appropriate.<br /><br />

            <strong>3. Competitions & Giveaways</strong><br />
            VidiGoals may run prize giveaways and competitions from time to time. By entering any VidiGoals giveaway or competition, you agree to the following:<br />
            • Entry is free and no purchase is necessary.<br />
            • Winners are determined by VidiGoals based on the stated criteria (e.g., highest gameweek score).<br />
            • All decisions made by VidiGoals regarding winners, eligibility, and prize distribution are final and not subject to appeal.<br />
            • Prizes will be distributed via email. Winners must email vidigoals@gmail.com to claim their prize. VidiGoals is not responsible for unclaimed prizes.<br />
            • VidiGoals reserves the right to disqualify any entrant suspected of fraudulent activity.<br />
            • VidiGoals reserves the right to cancel, modify, or suspend any competition at any time without prior notice.<br /><br />

            <strong>4. Accuracy of Information</strong><br />
            VidiGoals provides live football scores, FPL data, player statistics, and betting odds sourced from third-party providers. While we strive for accuracy, we cannot guarantee that all information displayed is 100% correct at all times. Data may be delayed, incomplete, or contain errors. VidiGoals is not responsible for any decisions made based on information displayed on the Service.<br /><br />

            <strong>5. Betting & Odds Information</strong><br />
            Odds displayed on VidiGoals are for informational purposes only. VidiGoals does not operate as a bookmaker and does not accept bets. Users are redirected to third-party betting sites at their own risk. VidiGoals is not responsible for any losses incurred through gambling. Please gamble responsibly.<br /><br />

            <strong>6. Intellectual Property</strong><br />
            VidiGoals is an independent project and is not affiliated with, endorsed by, or connected to the Premier League, Fantasy Premier League, or any football club. Team logos and player names are property of their respective owners and are used for informational purposes only.<br /><br />

            <strong>7. Limitation of Liability</strong><br />
            The Service is provided "as is" without warranty of any kind, express or implied. VidiGoals shall not be liable for any direct, indirect, incidental, or consequential damages arising from your use of the Service.<br /><br />

            <strong>8. Privacy</strong><br />
            VidiGoals does not collect personal data beyond your FPL Manager ID. No passwords are stored. Your usage data may be processed by our hosting provider (Vercel) in accordance with their privacy policy.<br /><br />

            <strong>9. Modifications</strong><br />
            We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.<br /><br />

            <strong>10. Data Sources & Technical Information</strong><br />
            Match data is provided by API-Football. FPL data is sourced from the official Fantasy Premier League API. Odds data is sourced from third-party bookmaker APIs. Data refresh intervals vary by feature and may range from 30 seconds to several hours depending on the type of information and current match status. All times displayed are in UK (Europe/London) timezone.<br /><br />

            <strong>11. Contact</strong><br />
            For any queries regarding these terms, please contact vidigoals@gmail.com.
          </MenuAccordion>
        </MenuSection>
      </MenuPanel>

      {/* ── Top bar ── */}
      <TopBar>
        <MenuBtn onClick={() => setMenuOpen(true)}>☰</MenuBtn>
        <Logo href="/">⚽ Vidi<span>Goals</span></Logo>
        {user && <LogoutBtn onClick={onLogout}>Logout</LogoutBtn>}
      </TopBar>

      {/* ── User bar ── */}
      <UserBar>
        <UserInfo>
          <div>Hello {teamName || 'Guest'}</div>
          <div>
            {isLive && <><LiveDot />Live · </>}
            {timeStr} | {dateStr}
          </div>
        </UserInfo>
        {user ? (
          page === 'feed'
            ? <NavBtn href="/my-team">View Team</NavBtn>
            : <NavBtn href="/">View Goals</NavBtn>
        ) : (
          <NavBtn href="/signin">Sign in</NavBtn>
        )}
      </UserBar>

      {/* ── Points bar (logged in only) ── */}
      {user && (
        <PointsBar>
          <div>GW Points <span>{livePoints.gw !== null ? livePoints.gw : (user.gwPoints || '—')}</span></div>
          <div>Overall Points <span>{livePoints.overall || user.overallPoints || '—'}</span></div>
        </PointsBar>
      )}

      {children}
    </>
  );
}
