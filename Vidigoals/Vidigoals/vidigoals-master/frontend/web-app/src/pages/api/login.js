/**
 * API Route: /api/login
 *
 * Authenticates against the Fantasy Premier League API.
 *
 * Flow:
 *  1. GET the FPL login page to obtain a CSRF token + session cookie.
 *  2. POST credentials to the FPL login endpoint.
 *  3. Check the redirect location for success/failure.
 *  4. If successful, fetch the user profile from /api/me/.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { login, password } = req.body || {};

  if (!login || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const FPL_LOGIN_URL = 'https://users.premierleague.com/accounts/login/';
  const FPL_PROFILE_URL = 'https://fantasy.premierleague.com/api/me/';
  const REDIRECT_URI = 'https://fantasy.premierleague.com/a/login';

  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // Helper: safely extract Set-Cookie headers across Node versions
  function getCookies(response) {
    try {
      if (typeof response.headers.getSetCookie === 'function') {
        return response.headers.getSetCookie();
      }
      const raw = response.headers.get('set-cookie');
      if (!raw) return [];
      // Split on commas that are followed by a cookie name (not a date value)
      return raw.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
    } catch {
      return [];
    }
  }

  // Helper: parse cookie key=value pairs into a header string
  function buildCookieHeader(cookieArrays) {
    const map = new Map();
    for (const c of cookieArrays.flat()) {
      const kv = c.split(';')[0].trim();
      if (!kv) continue;
      const eqIdx = kv.indexOf('=');
      if (eqIdx === -1) continue;
      const key = kv.substring(0, eqIdx);
      map.set(key, kv);
    }
    return Array.from(map.values()).join('; ');
  }

  try {
    // ── Step 1: GET login page for CSRF token ──────────────────────────────
    let csrfToken = '';
    let initialCookies = [];

    try {
      const pageRes = await fetch(FPL_LOGIN_URL, {
        method: 'GET',
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-GB,en;q=0.9',
        },
        // Do NOT use redirect:'manual' here — let it follow redirects normally
      });

      initialCookies = getCookies(pageRes);

      const csrfCookie = initialCookies
        .map((c) => c.split(';')[0].trim())
        .find((c) => c.startsWith('csrftoken='));

      if (csrfCookie) {
        csrfToken = csrfCookie.split('=')[1];
      }
    } catch (pageErr) {
      // Non-fatal — continue without CSRF token
      console.warn('Could not fetch FPL login page:', pageErr.message);
    }

    // ── Step 2: POST credentials ───────────────────────────────────────────
    const formBody = new URLSearchParams({
      login,
      password,
      redirect_uri: REDIRECT_URI,
      app: 'plfpl-web',
    });

    if (csrfToken) {
      formBody.append('csrfmiddlewaretoken', csrfToken);
    }

    const cookieHeader = buildCookieHeader([initialCookies]);

    const loginRes = await fetch(FPL_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': UA,
        Referer: FPL_LOGIN_URL,
        Origin: 'https://users.premierleague.com',
        'Accept-Language': 'en-GB,en;q=0.9',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
      },
      body: formBody.toString(),
      redirect: 'manual',
    });

    const location = loginRes.headers.get('location') || '';
    const loginCookies = getCookies(loginRes);
    const mergedCookieHeader = buildCookieHeader([initialCookies, loginCookies]);

    // Detect failure: FPL sends back a redirect to a fail URL, or no redirect at all
    const isFail =
      location.includes('state=fail') ||
      location.includes('reason=credentials') ||
      location.includes('state=error');

    const isSuccess =
      !isFail &&
      (location.includes('state=success') ||
        loginRes.status === 301 ||
        loginRes.status === 302);

    if (!isSuccess) {
      return res.status(401).json({
        success: false,
        message: isFail
          ? 'Invalid email or password. Please check your FPL credentials.'
          : 'Login failed. FPL may be temporarily unavailable.',
      });
    }

    // ── Step 3: Fetch FPL user profile ─────────────────────────────────────
    try {
      const profileRes = await fetch(FPL_PROFILE_URL, {
        method: 'GET',
        headers: {
          'User-Agent': UA,
          Cookie: mergedCookieHeader,
          Accept: 'application/json',
          Referer: 'https://fantasy.premierleague.com/',
        },
      });

      if (!profileRes.ok) {
        // Login succeeded but profile unavailable
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
    } catch (profileErr) {
      // Profile fetch failed but login was valid
      console.warn('Profile fetch failed:', profileErr.message);
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        first_name: null,
        last_name: null,
      });
    }
  } catch (err) {
    console.error('FPL login error:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: `Login error: ${err?.message || 'Unknown error'}`,
    });
  }
}
