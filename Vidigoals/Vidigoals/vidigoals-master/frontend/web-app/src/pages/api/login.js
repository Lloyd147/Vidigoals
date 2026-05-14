/**
 * API Route: /api/login
 *
 * Authenticates a user against the Fantasy Premier League API.
 *
 * Flow:
 *  1. GET the FPL login page to obtain a CSRF token and session cookie.
 *  2. POST credentials + CSRF token to the FPL login endpoint.
 *  3. If successful, fetch the user's profile from /api/me/.
 *  4. Return the profile data to the client.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const FPL_LOGIN_URL = 'https://users.premierleague.com/accounts/login/';
  const FPL_PROFILE_URL = 'https://fantasy.premierleague.com/api/me/';
  const REDIRECT_URI = 'https://fantasy.premierleague.com/a/login';

  try {
    // ── Step 1: GET the login page to grab the CSRF token ──────────────────
    const loginPageRes = await fetch(FPL_LOGIN_URL, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
    });

    // Collect cookies from the initial GET
    const rawCookies = loginPageRes.headers.getSetCookie
      ? loginPageRes.headers.getSetCookie()
      : (loginPageRes.headers.get('set-cookie') || '').split(/,(?=[^ ])/);

    const cookieHeader = rawCookies
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    // Extract csrftoken from cookies
    const csrfMatch = rawCookies
      .map((c) => c.split(';')[0].trim())
      .find((c) => c.startsWith('csrftoken='));

    const csrfToken = csrfMatch ? csrfMatch.split('=')[1] : '';

    // ── Step 2: POST credentials to FPL login endpoint ─────────────────────
    const formBody = new URLSearchParams({
      login,
      password,
      redirect_uri: REDIRECT_URI,
      app: 'plfpl-web',
    });

    if (csrfToken) {
      formBody.append('csrfmiddlewaretoken', csrfToken);
    }

    const loginRes = await fetch(FPL_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: FPL_LOGIN_URL,
        Origin: 'https://users.premierleague.com',
        Cookie: cookieHeader,
        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      },
      body: formBody.toString(),
      redirect: 'manual',
    });

    const location = loginRes.headers.get('location') || '';
    const loginCookies = loginRes.headers.getSetCookie
      ? loginRes.headers.getSetCookie()
      : (loginRes.headers.get('set-cookie') || '').split(/,(?=[^ ])/);

    // Merge all cookies (initial GET + POST response)
    const allCookies = [...rawCookies, ...loginCookies]
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean);

    // Deduplicate by key name (later values win)
    const cookieMap = new Map();
    for (const c of allCookies) {
      const [key] = c.split('=');
      cookieMap.set(key, c);
    }
    const mergedCookieHeader = Array.from(cookieMap.values()).join('; ');

    // FPL redirects to a URL containing "state=success" on valid credentials
    const loginSucceeded =
      location.includes('state=success') ||
      loginRes.status === 302 ||
      loginRes.status === 301;

    if (!loginSucceeded || location.includes('state=fail') || location.includes('reason=credentials')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please check your FPL credentials.',
      });
    }

    // ── Step 3: Fetch the FPL user profile ─────────────────────────────────
    const profileRes = await fetch(FPL_PROFILE_URL, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Cookie: mergedCookieHeader,
        Accept: 'application/json',
        Referer: 'https://fantasy.premierleague.com/',
      },
    });

    if (!profileRes.ok) {
      // Login worked but profile fetch failed — still a partial success
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        first_name: null,
        last_name: null,
      });
    }

    const profileData = await profileRes.json();
    const player = profileData?.player || profileData;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      first_name: player?.first_name || null,
      last_name: player?.last_name || null,
      entry: player?.entry || null,
      region: player?.region || null,
    });
  } catch (err) {
    console.error('FPL login error:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    });
  }
}
