import { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background: #1a1a2e;
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
  background: #16213e;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
`;

const Logo = styled.h1`
  font-size: 2rem;
  font-weight: 800;
  text-align: center;
  margin-bottom: 0.25rem;
  color: #e94560;
  letter-spacing: 1px;
`;

const Subtitle = styled.p`
  text-align: center;
  color: #8892b0;
  font-size: 0.9rem;
  margin-bottom: 2rem;
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
  border: 1px solid #0f3460;
  background: #0f3460;
  color: #eaeaea;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;

  &:focus {
    border-color: #e94560;
  }

  &::placeholder {
    color: #4a5568;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 0.85rem;
  border-radius: 8px;
  border: none;
  background: #e94560;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.2s, opacity 0.2s;

  &:hover:not(:disabled) {
    background: #c73652;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Message = styled.p`
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
  color: ${({ success }) => (success ? '#48bb78' : '#fc8181')};
`;

const FPLNote = styled.p`
  margin-top: 1.5rem;
  text-align: center;
  font-size: 0.78rem;
  color: #4a5568;
`;

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const query = `
        mutation Login($login: String!, $password: String!) {
          login(login: $login, password: $password) {
            success
            message
            first_name
            last_name
          }
        }
      `;

      const res = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { login: email, password } }),
      });

      const { data, errors } = await res.json();

      if (errors) {
        setResult({ success: false, message: errors[0].message });
      } else if (data?.login?.success) {
        setResult({
          success: true,
          message: `Welcome, ${data.login.first_name || 'Manager'}! Login successful.`,
        });
      } else {
        setResult({ success: false, message: data?.login?.message || 'Login failed.' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Could not connect to the server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalStyle />
      <PageWrapper>
        <Card>
          <Logo>Vidigoals</Logo>
          <Subtitle>Sign in with your Fantasy Premier League account</Subtitle>
          <Form onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">FPL Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </Form>
          {result && (
            <Message success={result.success}>{result.message}</Message>
          )}
          <FPLNote>
            Uses your official Fantasy Premier League credentials.
          </FPLNote>
        </Card>
      </PageWrapper>
    </>
  );
}
