/**
 * Debug endpoint — shows raw API-Football responses to diagnose feed issues.
 * Visit /api/debug-feed to see what's happening.
 */

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const data = await res.json();
  return { status: res.status, path, data };
}

function dateStr(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().split('T')[0];
}

export default async function handler(req, res) {
  if (!API_KEY) {
    return res.status(500).json({ error: 'No API key' });
  }

  const results = {};

  // Try both seasons
  try {
    results.live_2025 = await apiFetch('/fixtures?live=all&league=39&season=2025');
  } catch (e) { results.live_2025_error = e.message; }

  try {
    results.today_2025 = await apiFetch(`/fixtures?date=${dateStr(0)}&league=39&season=2025`);
  } catch (e) { results.today_2025_error = e.message; }

  try {
    results.yesterday_2025 = await apiFetch(`/fixtures?date=${dateStr(1)}&league=39&season=2025`);
  } catch (e) { results.yesterday_2025_error = e.message; }

  try {
    results.today_2024 = await apiFetch(`/fixtures?date=${dateStr(0)}&league=39&season=2024`);
  } catch (e) { results.today_2024_error = e.message; }

  try {
    results.yesterday_2024 = await apiFetch(`/fixtures?date=${dateStr(1)}&league=39&season=2024`);
  } catch (e) { results.yesterday_2024_error = e.message; }

  try {
    results.two_days_ago_2025 = await apiFetch(`/fixtures?date=${dateStr(2)}&league=39&season=2025`);
  } catch (e) { results.two_days_ago_error = e.message; }

  try {
    results.two_days_ago_2024 = await apiFetch(`/fixtures?date=${dateStr(2)}&league=39&season=2024`);
  } catch (e) { results.two_days_ago_2024_error = e.message; }

  results.dates_checked = {
    today: dateStr(0),
    yesterday: dateStr(1),
    two_days_ago: dateStr(2),
  };

  return res.status(200).json(results);
}
