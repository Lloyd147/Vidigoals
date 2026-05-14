import { useState } from 'react';
import Head from 'next/head';
import styled, { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a0a2e;
    color: #eaeaea;
    min-height: 100vh;
  }
`;

const PageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
`;

const Card = styled.div`
  background: #2d0a5e;
  border-radius: 14px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
`;

const Logo = styled.h1`
  font-size: 1.8rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 0.25rem;
  color: #fff;
  span { color: #f5a623; }
`;

const Subtitle = styled.p`
  text-align: center;
  color: #8892b0;
  font-size: 0.88rem;
  margin-bottom: 2rem;
  line-height: 1.5;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Label = styled.label`
  font-size: 0.85rem;
  color: #8892b0;
  margin-bottom: 0.25rem;
  display: block;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #4a1a8e;
  background: #1a0a2e;
  color: #eaeaea;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  &:focus { border-color: #f5a623; }
  &::placeholder { color: #4a5568; }
  /* Remove number spinners */
  -moz-appearance: textfield;
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
`;

const Button = styled.button`
  width: 100%;
  padding: 0.85rem;
  border-radius: 8px;
  border: none;
  background: #f5a623;
  color: #1a0a2e;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.2s, opacity 0.2s;
  &:hover:not(:disabled) { background: #e09510; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const Message = styled.p`
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
  color: ${({ success }) => (success ? '#48bb78' : '#fc8181')};
`;

const HelpText = styled.div`
  margin-top: 1.5rem;
  padding: 1rem;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  font-size: 0.78rem;
  color: #8892b0;
  line-height: 1.6;
  a { color: #f5a623; text-decoration: none; }
`;

const BackLink = styled.a`
  display: block;
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.88rem;
  color: #8892b0;
  cursor: pointer;
  text-decoration: underline;
  &:hover { color: #eaeaea; }
`;

const TeamCard = styled.div`
  margin-top: 1.5rem;
  padding: 1.25rem;
  background: rgba(245,166,35,0.08);
  border: 1px solid rgba(245,166,35,0.3);
  border-radius: 10px;
  text-align: center;
`;

const TeamName = styled.div`
  font-size: 1.1rem;
  font-weight: 700;
  color: #f5a623;
  margin-bottom: 0.25rem;
`;

const ManagerName = styled.div`
  font-size: 0.88rem;
  color: #8892b0;
  margin-bottom: 0.75rem;
`;

const StatsRow = styled.div`
  display: flex;
  justify-content: space-around;
  margin-top: 0.75rem;
`;

const Stat = styled.div`
  text-align: center;
  div:first-child { font-size: 1.2rem; font-weight: 800; color: #fff; }
  div:last-child  { font-size: 0.72rem; color: #8892b0; margin-top: 2px; }
`;

const ContinueBtn = styled.a`
  display: block;
  margin-top: 1rem;
  padding: 0.75rem;
  background: #6c2eb9;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  text-align: center;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
  &:hover { background: #7d3fd4; }
`;

export default function SignIn() {
  const [fplId, setFplId]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [team, setTeam]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = fplId.trim();
    if (!id || isNaN(id)) {
      setError('Please enter a valid FPL Manager ID (numbers only)');
      return;
    }

    setLoading(true);
    setError(null);
    setTeam(null);

    try {
      const res = await fetch(`/api/fpl-team?id=${id}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Could not find that FPL team');
      setTeam(data);
      // Store in sessionStorage so vidiprinter can read it
      sessionStorage.setItem('vidigoals_user', JSON.stringify(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign In — VidiGoals</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <GlobalStyle />
      <PageWrapper>
        <Card>
          <Logo>⚽ Vidi<span>Goals</span></Logo>
          <Subtitle>
            Enter your FPL Manager ID to link your team and see your points alongside the live feed.
          </Subtitle>

          {!team && (
            <Form onSubmit={handleSubmit}>
              <div>
                <Label htmlFor="fplId">FPL Manager ID</Label>
                <Input
                  id="fplId"
                  type="number"
                  placeholder="e.g. 1234567"
                  value={fplId}
                  onChange={(e) => setFplId(e.target.value)}
                  required
                  min="1"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Looking up team…' : 'Find My Team'}
              </Button>
            </Form>
          )}

          {error && <Message success={false}>{error}</Message>}

          {team && (
            <TeamCard>
              <TeamName>{team.name}</TeamName>
              <ManagerName>{team.player_first_name} {team.player_last_name}</ManagerName>
              <StatsRow>
                <Stat>
                  <div>{team.summary_overall_points ?? '—'}</div>
                  <div>Overall Pts</div>
                </Stat>
                <Stat>
                  <div>{team.summary_overall_rank?.toLocaleString() ?? '—'}</div>
                  <div>Overall Rank</div>
                </Stat>
                <Stat>
                  <div>{team.summary_event_points ?? '—'}</div>
                  <div>GW Points</div>
                </Stat>
              </StatsRow>
              <ContinueBtn href="/">Go to Live Feed →</ContinueBtn>
            </TeamCard>
          )}

          <HelpText>
            <strong>Where do I find my Manager ID?</strong><br />
            Log in to <a href="https://fantasy.premierleague.com" target="_blank" rel="noreferrer">fantasy.premierleague.com</a>, click <em>Points</em> — the number in the URL is your Manager ID.<br />
            e.g. fantasy.premierleague.com/entry/<strong>1234567</strong>/event/38
          </HelpText>

          <BackLink href="/">← Back to live feed</BackLink>
        </Card>
      </PageWrapper>
    </>
  );
}
