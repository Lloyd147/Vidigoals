import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle, keyframes } from 'styled-components';
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

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const Wrapper = styled.div`
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a0a2e;
`;

const LeagueBanner = styled.div`
  background: #6c2eb9;
  padding: 0.6rem 1rem;
  font-weight: 700;
  font-size: 0.95rem;
`;

const Feed = styled.div`flex: 1; overflow-y: auto;`;

const EventRow = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid #2d1a4e;
  gap: 0.85rem;
  animation: ${fadeIn} 0.3s ease;
  background: ${({ highlight }) => (highlight ? 'rgba(245,166,35,0.06)' : 'transparent')};
  &:hover { background: rgba(255,255,255,0.03); }
`;

const IconBox = styled.div`
  width: 42px; height: 42px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem;
`;

const MinuteBox = styled.div`
  width: 36px; flex-shrink: 0;
  font-size: 0.95rem; font-weight: 700;
  color: #8892b0; text-align: center;
  padding-top: 2px;
`;

const EventContent = styled.div`flex: 1; min-width: 0;`;

const ScoreLine = styled.div`
  font-size: 0.95rem; font-weight: 400; color: #ccc;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 3px;
  span.scorer { font-weight: 700; color: #fff; }
`;

const EventDetailLine = styled.div`
  font-size: 0.92rem; margin-top: 1px;
  font-style: italic; color: #8892b0;
  line-height: 1.4;
`;

const PlayerName = styled.span`
  font-weight: 700; font-style: normal;
  color: ${({ color }) => color || '#fff'};
`;

const PointsBadge = styled.span`
  font-weight: 700; font-style: normal;
  color: ${({ positive }) => positive ? '#48bb78' : '#fc8181'};
  margin-left: 3px;
`;

const AssistLine = styled.div`
  font-size: 0.88rem; margin-top: 2px;
  font-style: italic; color: #8892b0;
`;

const AssistName = styled.span`
  font-weight: 700; font-style: normal; color: #48bb78;
`;

const SubPlayer = styled.span`
  font-style: normal; color: #8892b0;
`;

const TeamBadge = styled.img`
  width: 38px; height: 38px;
  object-fit: contain; flex-shrink: 0;
`;

const HalfTimeRow = styled.div`
  display: flex; align-items: center;
  padding: 0.75rem 1.2rem;
  border-bottom: 1px solid #2d1a4e;
  gap: 0.85rem;
  background: rgba(108,46,185,0.15);
`;

const HTLabel = styled.div`
  width: 42px; font-size: 0.9rem; font-weight: 800;
  color: #fff; text-align: center;
`;

const HTScore = styled.div`font-size: 0.95rem; color: #8892b0; flex: 1;`;

const StatusMsg = styled.div`
  text-align: center; padding: 3rem 1rem;
  color: #8892b0; font-size: 0.9rem; line-height: 1.6;
`;

const RefreshBtn = styled.button`
  margin-top: 1rem; background: #6c2eb9; color: #fff;
  border: none; border-radius: 6px;
  padding: 0.5rem 1.2rem; font-size: 0.85rem; cursor: pointer;
  &:hover { background: #7d3fd4; }
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

  return (
    <EventRow highlight={event.type === 'Goal' ? 1 : 0}>
      <IconBox>{cfg.icon}</IconBox>
      <MinuteBox>{formatMinute(event.minute, event.extraMinute)}</MinuteBox>
      <EventContent>
        <ScoreLine>
          {(event.type === 'Goal' || event.type === 'PenMiss' || event.type === 'PenSave') && event.isHome !== undefined ? (
            (() => {
              // Split score into parts: "Man Utd 1 - 0 Nott'm Forest"
              const parts = event.score.split(' - ');
              if (parts.length === 2) {
                // Home part: "Man Utd 1", Away part: "0 Nott'm Forest"
                const homePart = parts[0]; // e.g. "Man Utd 1"
                const awayPart = parts[1]; // e.g. "0 Nott'm Forest"
                if (event.isHome) {
                  return <><span className="scorer">{homePart}</span> - {awayPart}</>;
                } else {
                  return <>{homePart} - <span className="scorer">{awayPart}</span></>;
                }
              }
              return event.score;
            })()
          ) : event.score}
        </ScoreLine>

        {event.type === 'Goal' && (
          <>
            <EventDetailLine>
              {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
              <PointsBadge positive>+{event.goalPoints || 4}</PointsBadge>
            </EventDetailLine>
            {event.assist && (
              <AssistLine>
                Assist <AssistName>{event.assist}</AssistName>
                <PointsBadge positive>+3</PointsBadge>
              </AssistLine>
            )}
          </>
        )}

        {event.type === 'Sub' && (
          <EventDetailLine>
            Sub. <PlayerName color={cfg.color}>{event.player}</PlayerName>
            {event.assist && <><br /><SubPlayer>{event.assist}</SubPlayer></>}
          </EventDetailLine>
        )}

        {event.type === 'Yellow' && (
          <EventDetailLine>
            {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
            <PointsBadge>-1</PointsBadge>
          </EventDetailLine>
        )}

        {event.type === 'Red' && (
          <EventDetailLine>
            {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
            <PointsBadge>-3</PointsBadge>
          </EventDetailLine>
        )}

        {event.type === 'PenMiss' && (
          <EventDetailLine>
            {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
            <PointsBadge>-4</PointsBadge>
          </EventDetailLine>
        )}

        {event.type === 'PenSave' && (
          <EventDetailLine>
            {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
            <PointsBadge positive>+4</PointsBadge>
          </EventDetailLine>
        )}

        {event.type === 'VarGoal' && (
          <EventDetailLine>
            {cfg.label} <PlayerName color={cfg.color}>{event.player}</PlayerName>
          </EventDetailLine>
        )}
      </EventContent>
      {(event.teamLogo || event.homeLogo) && (
        <TeamBadge src={event.teamLogo || event.homeLogo} alt="" onError={e => { e.target.style.display = 'none'; }} />
      )}
    </EventRow>
  );
}

export default function Vidiprinter() {
  const [feed, setFeed]       = useState([]);
  const [isLive, setIsLive]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [user, setUser]       = useState(null);
  const [prefs, setPrefs]     = useState({
    showGoals: true, showCards: true, showSubs: false,
    showHtFt: true, showPenMiss: true, showPenSave: true,
  });
  const [filterOpen, setFilterOpen] = useState(false);

  function togglePref(key) {
    setPrefs(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('vidigoals_prefs', JSON.stringify(updated));
      return updated;
    });
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('vidigoals_user');
      if (stored) setUser(JSON.parse(stored));
      const p = localStorage.getItem('vidigoals_prefs');
      if (p) setPrefs(JSON.parse(p));
    } catch {}
  }, []);

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

  return (
    <>
      <Head>
        <title>VidiGoals — Live Premier League Feed</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <Wrapper>
        <AppShell user={user} page="feed" isLive={isLive} onLogout={handleLogout}>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid #2d1a4e' }}>
            <button onClick={() => setFilterOpen(!filterOpen)} style={{ background: 'transparent', border: '1px solid #4a1a8e', color: filterOpen ? '#f5a623' : '#8892b0', fontSize: '0.78rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {filterOpen ? '✕' : '☰'} Filter
            </button>
          </div>

          {/* Filter panel */}
          {filterOpen && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(45,10,94,0.4)', borderBottom: '1px solid #4a1a8e' }}>
              {[
                { key: 'showGoals', icon: '⚽', label: 'Show Goals' },
                { key: 'showCards', icon: '🟨', label: 'Show Cards' },
                { key: 'showSubs', icon: '🔄', label: 'Show Substitutions' },
                { key: 'showHtFt', icon: '⏱️', label: 'Show HT & FT Scores' },
                { key: 'showPenMiss', icon: '❌', label: 'Show Penalty Misses' },
                { key: 'showPenSave', icon: '🧤', label: 'Show Penalty Saves' },
              ].map(({ key, icon, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(74,26,142,0.3)' }}>
                  <span style={{ fontSize: '0.82rem', color: '#ccc' }}>{icon} {label}</span>
                  <button onClick={() => togglePref(key)} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: prefs[key] ? '#f5a623' : '#4a1a8e', position: 'relative', cursor: 'pointer' }}>
                    <span style={{ position: 'absolute', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', top: '3px', left: prefs[key] ? '23px' : '3px', transition: 'left 0.2s' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <LeagueBanner>🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</LeagueBanner>

          <Feed>
            {loading && <StatusMsg>Loading Premier League feed…</StatusMsg>}

            {!loading && error && (
              <StatusMsg>
                {error.includes('API key')
                  ? <>API key not configured.<br />Add API_FOOTBALL_KEY in Vercel environment variables.</>
                  : <>Could not load feed.<br />{error}</>}
                <br /><RefreshBtn onClick={fetchFeed}>Try again</RefreshBtn>
              </StatusMsg>
            )}

            {!loading && !error && feed.length === 0 && (
              <StatusMsg>
                No Premier League matches today.<br />Check back on a matchday!
                <br /><RefreshBtn onClick={fetchFeed}>Refresh</RefreshBtn>
              </StatusMsg>
            )}

            {!loading && !error && feed.filter(event => {
              if (event.type === 'Goal' && !prefs.showGoals) return false;
              if ((event.type === 'Yellow' || event.type === 'Red') && !prefs.showCards) return false;
              if (event.type === 'Sub' && !prefs.showSubs) return false;
              if ((event.type === 'HT' || event.type === 'FT') && !prefs.showHtFt) return false;
              if (event.type === 'PenMiss' && !prefs.showPenMiss) return false;
              if (event.type === 'PenSave' && !prefs.showPenSave) return false;
              return true;
            }).map(event => (
              <EventItem key={event.id} event={event} />
            ))}
          </Feed>
        </AppShell>

        <BottomNav>
          <NavItem href="/" active={1}><NavIcon>⚽</NavIcon>Goals</NavItem>
          <NavItem href={user ? '/my-team' : '/signin'}><NavIcon>👕</NavIcon>My Team</NavItem>
          <NavItem href="/leaderboard"><NavIcon>🏆</NavIcon>Leagues</NavItem>
          <NavItem href="/matches"><NavIcon>📋</NavIcon>Matches</NavItem>
          <NavItem href="/price-changes"><NavIcon>📈</NavIcon>Prices</NavItem>
        </BottomNav>
      </Wrapper>
    </>
  );
}

export async function getServerSideProps() {
  return { props: {} };
}
