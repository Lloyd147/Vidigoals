/**
 * API Protection Middleware
 *
 * 1. Rate limiting: 60 requests per minute per IP
 * 2. Origin/Referer check: only allows requests from vidigoals.com or localhost
 *
 * Usage in any API route:
 *   import { protect } from '../../lib/api-protection';
 *   export default async function handler(req, res) {
 *     const blocked = protect(req, res);
 *     if (blocked) return;
 *     // ... rest of handler
 *   }
 */

// In-memory rate limit store: { ip: { count, resetAt } }
const rateLimitStore = new Map();
const RATE_LIMIT = 60; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

// Allowed origins (your domain + localhost for dev)
const ALLOWED_ORIGINS = [
  'https://vidigoals.com',
  'https://www.vidigoals.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    return true;
  }
  return false;
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  // Allow if no origin/referer (server-side calls, curl for testing)
  // But block if origin is set and doesn't match
  if (!origin && !referer) return true;

  // Check origin
  if (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return true;

  // Check referer
  if (referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o))) return true;

  // Also allow Vercel preview deployments
  if (origin && origin.includes('.vercel.app')) return true;
  if (referer && referer.includes('.vercel.app')) return true;

  return false;
}

/**
 * Protect an API route. Returns true if request was blocked (response already sent).
 * Returns false if request is allowed to proceed.
 */
export function protect(req, res) {
  // Rate limiting
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return true;
  }

  // Origin check (only for sensitive endpoints)
  if (!isAllowedOrigin(req)) {
    res.status(403).json({ error: 'Forbidden' });
    return true;
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  return false;
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt + RATE_WINDOW) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes
