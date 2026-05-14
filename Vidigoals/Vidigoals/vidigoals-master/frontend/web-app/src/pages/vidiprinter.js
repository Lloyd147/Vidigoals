import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle, keyframes } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a0a2e;
    color: #eaeaea;
    min-height: 100vh;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
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

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  span { color: #f5a623; }
`;

const NotifToggle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #ccc;
`;

const Toggle = styled.button`
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: ${({ on }) => (on ? '#f5a623' : '#555')};
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  &::after {
    content: '';
    position: absolute;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #fff;
    top: 3px;
    left: ${({ on }) => (on ? '21px' : '3px')};
    transition: left 0.2s;
  }
`;

const LeagueBanner = styled.div`
  background: #6c2eb9;
  padding: 0.6rem 1rem;
  font-weight: 700;
  font-size: 0.95rem;
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

const UserActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionBtn = styled.a`
  background: ${({ variant }) => variant === 'outline' ? 'transparent' : '#f5a623'};
  color: ${({ variant }) => variant === 'outline' ? '#8892b0' : '#1a0a2e'};
  border: ${({ variant }) => variant === 'outline' ? '1px solid #4a1a8e' : 'none'};
  font-weight: 700;
  font-size: 0.78rem;
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: ${({ variant }) => variant === 'outline' ? '#2d1a4e' : '#e09510'};
  }
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

const PointsBar = styled.div`
  padding: 0.6rem 1rem;
  display: flex;
  gap: 2rem;
  border-bottom: 1px solid #2d1a4e;
  background: rgba(108,46,185,0.1);
  font-size: 0.85rem;
  color: #8892b0;
  span { color: #f5a623; font-weight: 700; }
`;

// ── Feed ──────────────────────────────────────────────────────────────────────
const Feed = styled.div`flex: 1; overflow-y: auto;`;

const EventRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #2d1a4e;
  gap: 0.75rem;
  animation: ${fadeIn} 0.3s ease;
  background: ${({ highlight }) => (highlight ? 'rgba(245,166,35,0.06)' : 'transparent')};
  &:hover { background: rgba(255,255,255,0.03); }
`;

const IconBox = styled.div`
  width: 36px; height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
`;

const MinuteBox = styled.div`
  width: 32px;
  flex-shrink: 0;
  font-size: 0.82rem;
  font-weight: 700;
  color: #8892b0;
  text-align: center;
`;

const EventContent = styled.div`flex: 1; min-width: 0;`;

const ScoreLine = styled.div`
  font-size: 0.88rem;
  font-weight: 600;
  color: #ccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EventDetail = styled.div`
  font-size: 0.82rem;
  margin-top: 2px;
  font-style: italic;
  color: #8892b0;
`;

const PlayerName = styled.span`
  font-weight: 700;
  font-style: normal;
  color: ${({ color }) => color || '#fff'};
`;

const AssistName = styled.span`
  font-weight: 700;
  font-style: normal;
  color: #48bb78;
`;

const TeamBadge = styled.img`
  width: 32px; height: 32px;
  object-fit: contain;
  flex-shrink: 0;
`;

const HalfTimeRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid #2d1a4e;
  gap: 0.75rem;
  background: rgba(108,46,185,0.15);
`;

const HTLabel = styled.div`
  width: 36px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #6c2eb9;
  text-align: center;
  background: rgba(108,46,185,0.3);
  border-radius: 4px;
  padding: 2px 4px;
`;

const HTScore = styled.div`
  font-size: 0.88rem;
  color: #8892b0;
  flex: 1;
`;

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.6;
`;

const LiveDot = styled.span`
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #48bb78;
  margin-right: 6px;
  animation: pulse 1.5s infinite;
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
`;

const RefreshBtn = styled.button`
  margin-top: 1rem;
  background: #6c2eb9;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.2rem;
  font-size: 0.85rem;
  cursor: pointer;
  &:hover { background: #7d3fd4; }
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

// ── Event config ──────────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  Goal:    { icon: '⚽', color: '#48bb78', label: 'Goal!' },
  Yellow:  { icon: '🟨', color: '#f5a623', label: 'Yellow' },
  Red:     { icon: '🟥', color: '#fc8181', label: 'Red' },
  Sub:     { icon: '🔄', color: '#63b3ed', label: 'Sub.' },
  PenMiss: { icon: '❌⚽', color: '#fc8181', label: 'Pen. Miss!' },
  PenSave: { icon: '🧤', color: '#48bb78', label: 'Pen. Save!' },
  VarGoal: { icon: '📺', color: '#fc8181', label: 'VAR - Goal Cancelled' },
  HT:      { icon: 'HT', color: '#6c2eb9', label: 'Half Time' },
  FT:      { icon: 'FT', color: '#6c2eb9', label: 'Full Time' },
};

function formatMinute(minute, extra) {
  if (!minute) return '';
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

function EventItem({ event }) {
  const cfg = EVENT_CONFIG[event.type] || { icon: '•', color: '#fff', label: event.type };

  if (event.type === 'HT' || event.type === 'FT') {
    return (
      <HalfTimeRow>
        <HTLabel>{cfg.icon}</HTLabel>
        <HTScore>{event.score}</HTScore>
      </HalfTimeRow>
    );
  }

  const badgeSrc = event.teamLogo || event.homeLogo;

  return (
    <EventRow highlight={event.type === 'Goal' ? 1 : 0}>
      <IconBox>{cfg.icon}</IconBox>
      <MinuteBox>{formatMinute(event.minute, event.extraMinute)}</MinuteBox>
      <EventContent>
        <ScoreLine>{event.score}</ScoreLine>
        <EventDetail>
          {event.type === 'Sub' ? (
            <>Sub. <PlayerName color={cfg.color}>{event.player}</PlayerName>{event.assist && <> ↓ {event.assist}</>}</>
          ) : event.type === 'Goal' ? (
            <>{cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>{event.assist && <> · Assist <AssistName>{event.assist}</AssistName></>}</>
          ) : (
            <>{cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName></>
          )}
        </EventDetail>
      </EventContent>
      {badgeSrc && (
        <TeamBadge src={badgeSrc} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
      )}
    </EventRow>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Vidiprinter() {
  const [feed, setFeed]       = useState([]);
  const [isLive, setIsLive]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [notifs, setNotifs]   = useState(true);
  const [user, setUser]       = useState(null); // { id, name, gwPoints, overallPoints, managerName }

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const fetchFeed = useCallback(async () => {
    try {
      const res  = await fetch('/api/feed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeed(data.feed || []);
      setIsLive(data.isLive || false);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const handleLogout = () => {
    localStorage.removeItem('vidigoals_user');
    setUser(null);
  };

  const teamDisplayName = user?.name || user?.managerName || null;

  return (
    <>
      <Head>
        <title>VidiGoals — Live Premier League Feed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        {/* Top bar */}
        <TopBar>
          <Logo>⚽ Vidi<span>Goals</span></Logo>
          <NotifToggle>
            Notifications
            <Toggle on={notifs ? 1 : 0} onClick={() => setNotifs(n => !n)} aria-label="Toggle notifications" />
          </NotifToggle>
        </TopBar>

        {/* League banner */}
        <LeagueBanner>🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</LeagueBanner>

        {/* User bar */}
        <UserBar>
          <UserInfo>
            <div>Hello {teamDisplayName ? teamDisplayName : 'Guest'}</div>
            <div>
              {isLive && <><LiveDot />Live · </>}
              {timeStr} | {dateStr}
            </div>
          </UserInfo>
          <UserActions>
            {user ? (
              <>
                <ActionBtn href="/my-team">View Team</ActionBtn>
                <LogoutBtn onClick={handleLogout}>Logout</LogoutBtn>
              </>
            ) : (
              <ActionBtn href="/signin">Sign in</ActionBtn>
            )}
          </UserActions>
        </UserBar>

        {/* Points bar — only when logged in */}
        {user && (
          <PointsBar>
            <div>GW Points <span>{user.gwPoints ?? '—'}</span></div>
            <div>Overall Points <span>{user.overallPoints ?? '—'}</span></div>
          </PointsBar>
        )}

        {/* Feed */}
        <Feed>
          {loading && <StatusMsg>Loading Premier League feed…</StatusMsg>}

          {!loading && error && (
            <StatusMsg>
              {error.includes('API key') ? (
                <>API key not configured.<br />Add API_FOOTBALL_KEY in Vercel environment variables.</>
              ) : (
                <>Could not load feed.<br />{error}</>
              )}
              <br /><RefreshBtn onClick={fetchFeed}>Try again</RefreshBtn>
            </StatusMsg>
          )}

          {!loading && !error && feed.length === 0 && (
            <StatusMsg>
              No Premier League matches today.<br />Check back on a matchday!
              <br /><RefreshBtn onClick={fetchFeed}>Refresh</RefreshBtn>
            </StatusMsg>
          )}

          {!loading && !error && feed.map(event => (
            <EventItem key={event.id} event={event} />
          ))}
        </Feed>

        {/* Bottom nav */}
        <BottomNav>
          <NavItem href="/" active={1}>
            <NavIcon>⚽</NavIcon>Goals
          </NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}>
            <NavIcon>👕</NavIcon>{user ? 'My Team' : 'Sign In'}
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

export async function getServerSideProps() {
  return { props: {} };
}
