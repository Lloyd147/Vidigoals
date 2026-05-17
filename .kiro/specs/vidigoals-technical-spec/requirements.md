# VidiGoals — Technical Specification

## Overview

VidiGoals is a live Premier League goal feed web application built with Next.js 14, deployed on Vercel, using API-Football for match data and the FPL API for Fantasy Premier League integration.

- **Live URL:** vidigoals.vercel.app / www.vidigoals.com
- **Repo:** github.com/Lloyd147/Vidigoals
- **Stack:** Next.js 14, React 18, styled-components, Vercel Serverless Functions
- **Data Sources:** API-Football (paid, 7,500 calls/day), FPL API (free), Upstash Redis (free tier)
- **Season:** 2025 (2025/26 Premier League, league ID 39)

## Pages

### 1. Goal Feed (Homepage)
- Default homepage, accessible without login
- Shows last 7 days of PL events (max 100)
- Event types: Goal, Yellow Card, Red Card, Sub, Pen Miss, Pen Save, HT, FT, VAR Goal Cancelled
- Each event: icon | minute | score (normal weight) | player (bold) | FPL points | team badge
- Assist shown on separate line below goal
- FPL points: Goal +4, Assist +3, Yellow -1, Red -3, Pen Miss -4, Pen Save +4
- Filtering from Settings (subs off by default)
- Polling: 30s (cache: 30s live, 5min idle)
- Logged in: team name, GW/Overall Points, View Team button
- Guest: Hello Guest, Sign in button

### 2. My Team
- FPL Manager ID login required
- Pitch view: SVG shirts with team colours, grouped by position
- Captain/Vice badges, GW-specific points per player
- GW navigation, stats row, active chip badge, substitutes

### 3. Matches
- GW 1-38 navigation, fixtures sorted by date
- Abbreviated team names, team logos
- Live: green pulsing score + LIVE badge + minutes above score
- Expandable: Match Details | Match Stats | Lineups tabs
- Match Details: Goals, Assists, Cards, Saves (always show headers), Bonus
- Match Stats: Possession, xG, Shots, Corners, Fouls, Offsides, Saves, Passes
- Lineups: Formation, Starting XI, Substitutes
- Players grouped: "Watkins (57', 73')"

### 4. Sign In
- FPL Manager ID input, fetches public data, saves to localStorage
- Redirects to My Team after login

### 5. Settings
- Notification toggles (localStorage), collapsible T&Cs

### 6. Leaderboard
- Coming Soon placeholder

## API Routes

### /api/feed
- Source: API-Football from/to date range (7 days)
- Re-fetches by ID for missing events
- Assist reconciliation via Upstash Redis during live matches
- Cache: 30s live, 5min idle

### /api/fixtures
- Source: API-Football by round
- Sorted chronologically, abbreviated names, elapsed minutes
- Cache: 30s live, 5min idle

### /api/match-details
- Source: API-Football fixtures + statistics + lineups + FPL bonus
- Grouped players, minutes on all events, GK names on saves
- Live: show 0 not dash for stats
- Cache: 30s live, 10min idle

### /api/fpl-picks
- Source: FPL bootstrap + picks + live endpoint for GW-specific points
- Cache: 2min

### /api/fpl-team
- Source: FPL entry endpoint
- Cache: 5min

### /api/assist-check
- Source: FPL fixtures + bootstrap + Upstash Redis
- Records goals, reconciles assists with FPL data

## Assist Reconciliation System

### Logic
1. Goal detected → store in Redis with API-Football assist + FPL assist count at that moment
2. Every 30s: check if FPL assist count increased
3. If increased → confirm/replace assist based on FPL
4. If 5min expires with no new FPL assist → remove assist
5. Multiple goals: each tracks own expected assist index

### CRITICAL FIX NEEDED
The system is built but not wired into the feed polling cycle. buildFeed() needs to call recordGoal() for new goals and reconcileAssists() with FPL data each poll.

## Environment Variables
- API_FOOTBALL_KEY
- KV_REST_API_URL (Upstash)
- KV_REST_API_TOKEN (Upstash)

## Known Issues
1. Assist reconciliation not connected to feed polling
2. Match details should always show all section headers (even when empty)
3. Lineups need pitch view layout (currently list)
4. Predicted lineups from last match for upcoming fixtures
5. Commits must be authored by Lloyd147 (git config)
