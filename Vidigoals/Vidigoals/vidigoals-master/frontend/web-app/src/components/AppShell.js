/**
 * AppShell — shared top header used on every page.
 *
 * Shows:
 *  - Logo (top left)
 *  - Logout button (top right, when logged in)
 *  - User bar: "Hello [name]" | time/date | View Team OR View Goals button
 *  - Points bar: GW Points | Overall Points (when logged in)
 */
import styled from 'styled-components';

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

export default function AppShell({ user, page, isLive, onLogout, children }) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const teamName = user?.name || user?.managerName || null;

  return (
    <>
      {/* ── Top bar ── */}
      <TopBar>
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
          <div>GW Points <span>{user.gwPoints ?? '—'}</span></div>
          <div>Overall Points <span>{user.overallPoints ?? '—'}</span></div>
        </PointsBar>
      )}

      {children}
    </>
  );
}
