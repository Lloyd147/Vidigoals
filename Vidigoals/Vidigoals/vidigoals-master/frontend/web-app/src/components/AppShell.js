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
  const [livePoints, setLivePoints] = useState({ gw: user?.gwPoints, overall: user?.overallPoints });

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const teamName = user?.name || user?.managerName || null;

  // Fetch live GW points from FPL
  useEffect(() => {
    if (!user?.id) return;
    // Try the fpl-entry endpoint first, fall back to picks calculation
    fetch(`/api/fpl-entry?id=${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.summary_event_points > 0) {
          setLivePoints({ gw: data.summary_event_points, overall: data.summary_overall_points });
          try {
            const stored = JSON.parse(localStorage.getItem('vidigoals_user') || '{}');
            stored.gwPoints = data.summary_event_points;
            stored.overallPoints = data.summary_overall_points;
            localStorage.setItem('vidigoals_user', JSON.stringify(stored));
          } catch {}
        } else {
          // FPL entry endpoint returned 0 — calculate from picks
          fetch(`/api/fpl-picks?id=${user.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(picksData => {
              if (picksData?.starting) {
                const hits = picksData.entry_history?.event_transfers_cost || 0;
                const total = picksData.starting.reduce((sum, p) =>
                  sum + (p.event_points || 0) * (p.multiplier || 1), 0) - hits;
                if (total > 0) {
                  setLivePoints(prev => ({ ...prev, gw: total }));
                  try {
                    const stored = JSON.parse(localStorage.getItem('vidigoals_user') || '{}');
                    stored.gwPoints = total;
                    localStorage.setItem('vidigoals_user', JSON.stringify(stored));
                  } catch {}
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

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
          <MenuLink href="/" active={page === 'feed' ? 1 : 0}>Goals</MenuLink>
          <MenuLink href={user ? '/my-team' : '/signin'} active={page === 'my-team' ? 1 : 0}>My Team</MenuLink>
          <MenuLink href="/leaderboard" active={page === 'leaderboard' ? 1 : 0}>Leaderboard</MenuLink>
          <MenuLink href="/matches" active={page === 'matches' ? 1 : 0}>Matches</MenuLink>
          <MenuLink href="/price-changes" active={page === 'price-changes' ? 1 : 0}>Price Changes</MenuLink>
        </MenuSection>

        <MenuSection>
          <MenuSectionTitle>Settings</MenuSectionTitle>
          <MenuAccordion title="About VidiGoals">
            VidiGoals is a live FPL companion app that brings you real-time Premier League goal alerts, 
            FPL points tracking, bonus point system scores, and match statistics — all in one place. 
            Built for FPL managers who want instant updates on how their players are performing during live matches.
          </MenuAccordion>
          <MenuAccordion title="FAQ">
            <strong>How are assists determined?</strong><br />
            We use FPL's official assist data which may differ from what broadcasters show. FPL awards assists based on their own criteria.<br /><br />
            <strong>Why do points differ from the FPL app?</strong><br />
            Points update in real-time during matches. Final points are confirmed after bonus points are awarded (usually within an hour of full-time).<br /><br />
            <strong>How often does the feed update?</strong><br />
            Every 30 seconds during live matches, every 5 minutes otherwise.<br /><br />
            <strong>What is the Bonus Points System?</strong><br />
            BPS is FPL's scoring system that awards 3, 2, and 1 bonus points to the top performers in each match based on actions like goals, assists, tackles, and more.
          </MenuAccordion>
          <MenuAccordion title="Contact Us">
            Coming soon.
          </MenuAccordion>
          <MenuAccordion title="Terms & Conditions">
            By using VidiGoals, you agree to the following terms. VidiGoals provides live football scores and FPL data sourced from third-party APIs. 
            While we strive for accuracy, data may not always be 100% up-to-date. VidiGoals is not responsible for discrepancies between displayed data and official results.<br /><br />
            Match data is provided by API-Football. FPL data is sourced from the official Fantasy Premier League API. 
            Team logos are property of their respective clubs and used for informational purposes only.<br /><br />
            VidiGoals is an independent project and is not affiliated with, endorsed by, or connected to the Premier League or FPL. 
            The service is provided "as is" without warranty. We reserve the right to update these terms at any time.
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
          <div>GW Points <span>{livePoints.gw ?? user.gwPoints ?? '—'}</span></div>
          <div>Overall Points <span>{livePoints.overall ?? user.overallPoints ?? '—'}</span></div>
        </PointsBar>
      )}

      {children}
    </>
  );
}
