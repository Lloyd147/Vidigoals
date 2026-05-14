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
    width: 16px;
    height: 16px;
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
  letter-spacing: 0.5px;
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

const SignInBtn = styled.a`
  background: #f5a623;
  color: #1a0a2e;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.45rem 1.1rem;
  border-radius: 6px;
  text-decoration: none;
  cursor: pointer;
  &:hover { background: #e09510; }
`;

const PointsBar = styled.div`
  padding: 0.5rem 1rem;
  display: flex;
  gap: 2rem;
  border-bottom: 1px solid #2d1a4e;
  font-size: 0.85rem;
  color: #8892b0;
  span { color: #fff; font-weight: 700; }
`;

// ── Feed ──────────────────────────────────────────────────────────────────────

const Feed = styled.div`
  flex: 1;
  overflow-y: auto;
`;

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
  width: 36px;
  height: 36px;
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

const EventContent = styled.div`
  flex: 1;
  min-width: 0;
`;

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
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
`;

const HalfTimeRow = styled.div`
  display: flex;
  align-items: center;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid #2d1a4e;
  gap: 0.75rem;
  background: rgba(108, 46, 185, 0.15);
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

// ── Status / Empty ────────────────────────────────────────────────────────────

const StatusMsg = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #8892b0;
  font-size: 0.9rem;
  line-height: 1.6;
`;

const LiveDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
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
            <>
              Sub. <PlayerName color={cfg.color}>{event.player}</PlayerName>
              {event.assist && <> ↓ {event.assist}</>}
            </>
          ) : event.type === 'Goal' ? (
            <>
              {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
              {event.assist && (
                <> · Assist <AssistName>{event.assist}</AssistName></>
              )}
            </>
          ) : (
            <>
              {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
            </>
          )}
        </EventDetail>
      </EventContent>
      {badgeSrc && (
        <TeamBadge
          src={badgeSrc}
          alt={event.isHome ? event.homeTeam : event.awayTeam}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
    </EventRow>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Vidiprinter({ user }) {
  const [feed, setFeed]         = useState([]);
  const [isLive, setIsLive]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [notifs, setNotifs]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeed(data.feed || []);
      setIsLive(data.isLive || false);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    // Poll every 30 seconds — server cache ensures only 1 API call per 30s
    // regardless of how many users are on the site simultaneously
    const interval = setInterval(fetchFeed, 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

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
            <Toggle on={notifs ? 1 : 0} onClick={() => setNotifs((n) => !n)} aria-label="Toggle notifications" />
          </NotifToggle>
        </TopBar>

        {/* League banner */}
        <LeagueBanner>🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</LeagueBanner>

        {/* User bar */}
        <UserBar>
          <UserInfo>
            <div>Hello {user ? user.first_name || 'Manager' : 'Guest'}</div>
            <div>
              {isLive && <><LiveDot />Live · </>}
              {timeStr} | {dateStr}
            </div>
          </UserInfo>
          {!user && <SignInBtn href="/signin">Sign in</SignInBtn>}
        </UserBar>

        {/* Points bar — only shown when logged in */}
        {user && (
          <PointsBar>
            <div>GW Points <span>{user.gwPoints ?? '—'}</span></div>
            <div>Overall <span>{user.overallPoints ?? '—'}</span></div>
          </PointsBar>
        )}

        {/* Feed */}
        <Feed>
          {loading && (
            <StatusMsg>Loading Premier League feed…</StatusMsg>
          )}

          {!loading && error && (
            <StatusMsg>
              {error.includes('API key') ? (
                <>API key not configured yet.<br />Add your API_FOOTBALL_KEY in Vercel environment variables.</>
              ) : (
                <>Could not load feed.<br />{error}</>
              )}
              <br />
              <RefreshBtn onClick={fetchFeed}>Try again</RefreshBtn>
            </StatusMsg>
          )}

          {!loading && !error && feed.length === 0 && (
            <StatusMsg>
              No Premier League matches today.<br />
              Check back on a matchday!
              <br />
              <RefreshBtn onClick={fetchFeed}>Refresh</RefreshBtn>
            </StatusMsg>
          )}

          {!loading && !error && feed.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </Feed>
      </Wrapper>
    </>
  );
}

export async function getServerSideProps(context) {
  // In future, read session cookie here to get logged-in user
  // For now, always guest
  return { props: { user: null } };
}
