# VidiGoals — Full Technical Specification

## Overview

VidiGoals is a real-time FPL (Fantasy Premier League) companion web app that provides live Premier League goal alerts, FPL points tracking, player odds, match statistics, and team management — all in a mobile-first progressive web interface.

**Live URL:** Deployed on Vercel (Pro tier, $20/month)
**Framework:** Next.js 14 (Pages Router)
**Styling:** styled-components v6
**Hosting:** Vercel (Pro tier — 60s function timeout)
**Data Sources:**
- API-Football (v3) — live scores, events, lineups, stats
- FPL Official API — player data, picks, points, fixtures, bootstrap
- Livescorebet UK internal API — player betting odds (free, no key)

**Environment Variables (Vercel):**
- `API_FOOTBALL_KEY` — API-Football subscription key
- `THE_ODDS_API_KEY` — (reserved, 488/500 monthly calls remaining — do not use)

---

## Architecture

```
Frontend (Next.js Pages Router)
├── src/pages/
│   ├── index.js              → redirects to vidiprinter
│   ├── vidiprinter.js        → Live goal feed (main page)
│   ├── my-team.js            → Team Points + Player Odds (two tabs)
│   ├── matches.js            → Fixtures list with expandable match details
│   ├── price-changes.js      → Price change predictions (placeholder)
│   ├── signin.js             → FPL Manager ID sign-in
│   ├── leaderboard.js        → (placeholder)
│   ├── settings.js           → (placeholder)
│   └── api/
│       ├── feed.js           → Live event feed (goals, cards, subs, HT/FT)
│       ├── fixtures.js       → GW fixtures with scores and status
│       ├── match-details.js  → Expanded match data (stats, lineups, BPS, bonus)
│       ├── fpl-picks.js      → Manager's team picks for a GW
│       ├── fpl-entry.js      → Live GW points calculation
│       ├── fpl-team.js       → Manager lookup by ID
│       ├── player-detail.js  → Player points breakdown popup data
│       ├── livescore-odds.js → Livescorebet scraping (all EPL player markets)
│       ├── login.js          → FPL credential login (CSRF flow)
│       ├── fetch-odds.js     → (legacy odds endpoint)
│       ├── player-odds.js    → (legacy odds endpoint)
│       ├── scrape-odds.js    → (legacy odds endpoint)
│       ├── assist-check.js   → Debug endpoint for assist verification
│       └── debug-feed.js     → Debug endpoint for feed inspection
├── src/components/
│   └── AppShell.js           → Shared header, menu, user bar, points bar
└── public/
    └── logos/                 → Bookie logo images (livescorebet.png, etc.)
```

---

## Package Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "styled-components": "^6.1.11",
    "graphql": "^16.8.1",
    "graphql-request": "^6.1.0",
    "@upstash/redis": "^1.34.3"
  }
}
```

---

## Design System

**Colour Palette:**
- Background: `#1a0a2e` (deep purple/navy)
- Card/Header: `#2d0a5e` (medium purple)
- Border: `#4a1a8e` (light purple)
- Accent/Gold: `#f5a623`
- Text Primary: `#eaeaea`
- Text Secondary: `#8892b0`
- Live/Success: `#48bb78` (green)
- Error/Red: `#fc8181`
- Blue accent: `#63b3ed`

**Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`)

**Layout:** Mobile-first, max-width 480px centered, full-height flex column

**All times displayed in `Europe/London` timezone.**

---

## 1. AppShell Component (`src/components/AppShell.js`)

Shared layout wrapper used on every page.

### Structure:
- **Top Bar (sticky):** Hamburger menu (☰) left, "⚽ VidiGoals" logo centered, Logout button right
- **User Bar:** "Hello [team name]" + time/date left, "View Team" or "View Goals" button right
- **Points Bar:** GW Points + Overall Points (calculated live from picks, not stale FPL value)

### Slide-out Menu (from left):
- **Notifications section:** Push Notifications toggle (placeholder)
- **Pages section:** Goals, My Team, Leaderboard, Matches, Price Changes
- **Settings section:** Accordions for About, FAQ, Contact, Terms & Conditions

### Live Points Calculation:
- On mount, fetches `/api/fpl-picks?id={userId}`
- Calculates GW points: `sum(starting XI event_points × multiplier) - transfer_cost`
- Overall points: `stored_overall_points + live_gw_points`
- Stores updated gwPoints in localStorage

### Props:
- `user` — user object from localStorage
- `page` — current page identifier (for active nav highlighting)
- `isLive` — boolean, shows green pulsing dot
- `onLogout` — callback
- `children` — page content

---

## 2. Sign In Page (`src/pages/signin.js`)

### Flow:
1. User enters FPL Manager ID (numeric)
2. Calls `/api/fpl-team?id={id}` to look up team
3. On success: stores user data in `localStorage('vidigoals_user')`
4. Redirects to `/my-team` after 1.5s

### Stored User Object:
```json
{
  "id": "1234567",
  "name": "Team Name FC",
  "managerName": "John Smith",
  "gwPoints": 45,
  "overallPoints": 1850,
  "overallRank": 125000
}
```

### UI:
- Centered card with logo, subtitle, input field, submit button
- On success: shows team card with name, manager, overall pts, rank, GW pts
- Help text explaining where to find Manager ID
- Back link to live feed

---

## 3. Live Goal Feed (`src/pages/vidiprinter.js`)

The main page of the app. Shows a real-time scrolling feed of Premier League match events.

### Features:
- Auto-refreshes every 30 seconds via `setInterval`
- Filter panel with toggles: Goals, Cards, Substitutions, HT/FT, Pen Misses, Pen Saves
- Filter preferences stored in `localStorage('vidigoals_prefs')`
- "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League" banner

### Event Types Displayed:
| Type | Icon | Points | Display |
|------|------|--------|---------|
| Goal | ⚽ | +4/+5/+6 (by position) | Player name, assist, running score |
| Yellow | 🟨 | -1 | Player name |
| Red | 🟥 | -3 | Player name |
| Sub | 🔄 | — | Player on, player off |
| PenMiss | ❌⚽ | -4 | Player name |
| PenSave | 🧤 | +4 | Player name |
| VarGoal | 📺 | — | Goal cancelled |
| HT | HT | — | Half-time score |
| FT | FT | — | Full-time score |

### Goal Points by Position:
- GK/DEF: +6 points
- MID: +5 points
- FWD: +4 points
- Assist (all positions): +3 points

### Score Display:
- For goals: the scoring team's side is bold/highlighted in the score line
- Running score shown at time of each event (not final score)

### Bottom Navigation (all pages):
- ⚽ Goals | 👕 My Team | 🏆 Leaderboard | 📋 Matches | 📈 Prices

---

## 4. Feed API (`src/pages/api/feed.js`)

### Data Flow:
1. Fetches all PL fixtures from last 7 days to today (single API-Football call)
2. For each started/finished fixture, extracts events (goals, cards, subs)
3. Reconciles assists with FPL (FPL is authoritative)
4. Adds FPL points per goal based on player position
5. Deduplicates events by deterministic ID
6. Sorts: newest date first, then highest minute first

### Caching:
- Feed cache: 30s TTL during live, 5min TTL when idle
- FPL Bootstrap cache: 30 minutes (global, shared across requests)
- FPL Fixtures cache: 2 minutes (assists update during live)
- Player position cache: in-memory Map, persists across requests

### Assist Reconciliation Rules:
1. FPL is the authoritative source for assists — always prioritize over API-Football
2. Never exceed FPL's total assist count per player (cap rule)
3. API-Football assists are kept if they match FPL data
4. Remaining FPL assists assigned to unassisted goals
5. During LIVE: new assists mapped to most recent unassisted goal (timing-based)
6. After FT: uses stored live mappings, falls back to chronological for unmapped

### Live Assist Mapping Store:
- `liveAssistStore` — in-memory Map keyed by `{fixtureId}-{side}`
- Tracks `lastKnownAssists` per player and `mappings` (player → goalMinute)
- Detects new assists by comparing current FPL count vs previous poll
- Assigns to most recent unassisted goal within the same side

### Team Name Matching:
- Hardcoded `TEAM_NAME_MAP` only — no fuzzy matching
- Maps API-Football names → FPL names (e.g., "Manchester City" → "man city", "Tottenham Hotspur" → "spurs")
- Fixture matching uses kickoff time (within 2-hour tolerance) + team IDs

### Player Position Lookup:
- `compact()` function strips dots, spaces, hyphens, apostrophes for matching
- Handles names like "E. Le Fee", "Son Heung-min", "N'Golo Kanté"
- Normalizes accents/diacritics via NFD decomposition
- Matches by: full name, web_name, second_name, compact forms
- Successful matches cached in `playerPositionCache` Map

### Event ID Format (deterministic, no Math.random):
```
{fixtureId}-{elapsed}-{extra}-{eventType}-{playerId}
```

---

## 5. Matches Page (`src/pages/matches.js`)

### Features:
- GW navigation (‹ Gameweek N ›) with bounds 1-38
- Fixtures grouped by date, sorted chronologically
- Each fixture row: home team (logo + name) | score/time | away team (logo + name) | expand arrow
- Live matches: green pulsing score box with "LIVE {minutes}'" badge
- Finished matches: white score
- Upcoming: gold kick-off time

### Expanded Match Details (click fixture row):
Three tabs: **Match Details** | **Match Stats** | **Lineups**

#### Match Details Tab:
- ⚽ Goals Scored (home vs away, player + minute)
- 🅰️ Assists (from FPL — player + count format: "B.Fernandes (2)")
- 🟨 Yellow Cards
- 🟥 Red Cards
- 🧤 Saves (goalkeeper name + count)
- Bonus Points (final 3/2/1 allocation from FPL)
- 📊 Bonus Points System (top 5 per side, running BPS scores)
- 🛡️ Defensive Contribution (top 5 per side from FPL)

#### Match Stats Tab:
- Possession, xG, Total Shots, Shots on Target, Shots off Target
- Corners, Fouls, Offsides, Goalkeeper Saves, Passes, Pass Accuracy

#### Lineups Tab:
- Formation display (e.g., "4-3-3")
- Pitch view with player dots positioned by formation
- Home team (blue dots) top half, Away team (red dots) bottom half
- Player numbers inside dots, names below
- SVG pitch markings: centre circle, halfway line, penalty areas, goal areas
- **Predicted lineups:** When official lineups unavailable, fetches team's last played fixture lineup
- Shows "⚠️ Predicted lineups (based on last match)" warning in gold

---

## 6. Match Details API (`src/pages/api/match-details.js`)

### Parameters:
- `fixtureId` (required) — API-Football fixture ID

### Returns:
```json
{
  "home": "Arsenal",
  "away": "Chelsea",
  "homeLogo": "url",
  "awayLogo": "url",
  "score": "2 - 1",
  "goals": { "home": [...], "away": [...] },
  "assists": { "home": [...], "away": [...] },
  "yellowCards": { "home": [...], "away": [...] },
  "redCards": { "home": [...], "away": [...] },
  "saves": { "home": { "player": "Raya", "count": 3 }, "away": {...} },
  "lineups": { "home": { "formation": "4-3-3", "startXI": [...], "subs": [...], "predicted": false }, "away": {...} },
  "bonus": { "home": [...], "away": [...] },
  "bps": { "home": [...], "away": [...] },
  "defensiveContribution": { "home": [...], "away": [...] },
  "stats": [{ "label": "Possession", "home": "55%", "away": "45%" }, ...]
}
```

### Caching:
- Finished matches: 24 hours
- Live matches: 30 seconds
- Upcoming matches: 2 minutes (reduced from 30min for near-kickoff accuracy)

### Predicted Lineups Logic:
1. If `startXI` is empty for a team, fetch that team's last played fixture
2. Get lineups from that fixture
3. Mark as `predicted: true`
4. Skip if the last fixture is the same one we're looking at

### FPL Data Integration:
- Matches API-Football fixture to FPL fixture via team name map + kickoff time (2hr tolerance)
- Extracts stats using `extractStat(identifier)` helper from FPL fixture stats array
- Handles team swap (FPL home/away may differ from API-Football)
- BPS and Defensive Contribution: top 5 per side, sorted by value descending
- FPL assists override API-Football assists (authoritative)

---

## 7. Fixtures API (`src/pages/api/fixtures.js`)

### Parameters:
- `round` (optional) — gameweek number (1-38)

### Logic:
1. If round specified: fetch `Regular Season - {round}` from API-Football
2. If no round: try today's date → next 10 → last 10 (fallback chain)
3. Group fixtures by date (formatted: "Sat 17 May")
4. All times in `Europe/London` timezone

### Returns:
```json
{
  "round": 37,
  "totalRounds": 38,
  "fixtures": { "Sat 17 May": [{ "id": 123, "time": "15:00", "status": "FT", "home": {...}, "away": {...} }] },
  "fixtureCount": 10,
  "isLive": false
}
```

### Caching:
- 30 seconds when live matches detected
- 5 minutes when idle

---

## 8. My Team Page (`src/pages/my-team.js`)

Two tabs: **Team Points** and **Player Odds**

### 8.1 Team Points Tab

#### GW Header:
- GW navigation (‹ Gameweek N ›) — bounds 1 to 38
- "CURRENT ROUND ACTIVE" badge with pulsing green dot (when viewing latest GW)
- Stats row: GW Points (with pulsing dot if live), GW Rank, Overall Rank, Transfers
- Chip badge: "Triple Captain Played" / "Bench Boost Played" / "Wildcard Played" / "Free Hit Played"

#### Pitch View:
- Green striped pitch background (alternating shades via linear-gradient)
- Pitch markings: centre circle, halfway line (via CSS pseudo-elements)
- Goal area: box + net drawn behind goalkeeper position
- VidiGoals advertising banners (left and right of goal area)
- Players arranged by position rows: GK → DEF → MID → FWD

#### Player Tiles (3-layer):
1. **SVG Shirt** — team-specific colours and patterns
2. **Info Box:**
   - Player name (white background, bold)
   - Fixture label (e.g., "CHE (A)") — or "LIVE 77'" in green if match in progress
   - Points badge (purple if has points, green+pulsing if live, dark if 0)
3. **Captain/Vice badge** — large circle on shirt (C = gold, V = purple)

#### Bench Section:
- Different shade of green background
- "YOUR BENCH" header
- Position labels (GKP, DEF, MID, FWD) above each bench player

#### GW Points Calculation:
- Calculated live: `sum(starting XI event_points × multiplier) - transfer_cost`
- Not using stale `entry_history.points` value
- Multiplier handles captain (×2) and triple captain (×3)

#### GW38 Handling:
- If GW38 picks unavailable (404), falls back to GW37 picks
- Shows GW38 fixtures (fetched from FPL fixtures endpoint filtered by event=38)
- Shows 0 points for all players
- No chip badge shown for fallback GW

### 8.2 SVG Shirt Component

Custom `ShirtSVG` component rendering team shirts with:
- **Body path** — main shirt shape with collar
- **Sleeve paths** — left and right sleeves (separate colour for solid pattern)
- **Patterns:** solid, stripes (via clipPath + rect elements at 6px intervals)
- **Solid background fill** on all paths to prevent pitch showing through
- **Unique clipPath IDs** per player: `clip-body-{teamId}-{playerId}`
- **Captain badge:** Gold circle with "C" (radius 10, font-size 12)
- **Vice badge:** Purple circle with "V"

#### Team Colours (by FPL team_id):
```
1  Arsenal:       red (#EF0107) / white sleeves, solid
2  Aston Villa:   brown (#670E36) / light blue sleeves, solid
3  Burnley:       brown (#670E36) / light blue sleeves, solid
4  Bournemouth:   dark red (#8B0000) / black, stripes
5  Brentford:     red (#E30613) / white, stripes
6  Brighton:      dark blue (#0057B8) / white, stripes
7  Chelsea:       dark blue (#034694), solid
8  Crystal Palace: dark blue (#1B458F) / red, stripes
9  Everton:       blue (#003399), solid
10 Fulham:        white / black sleeves, solid
11 Leeds:         white, solid
12 Liverpool:     dark red (#C8102E), solid
13 Man City:      light blue (#6CABDD), solid
14 Man Utd:       red (#DA291C), solid
15 Newcastle:     black (#241F20) / white, stripes
16 Nott'm Forest: red (#E53233) / white, stripes
17 Sunderland:    dark red (#8B0000) / white, stripes
18 Spurs:         white / dark blue (#132257) sleeves, solid
19 West Ham:      dark brown (#7A263A) / light blue sleeves, solid
20 Wolves:        orange (#FDB913), solid
```

### 8.3 Player Odds Tab

#### Layout:
- GW navigation (same as Team Points)
- Header banner (gold background): Pos | Player | GW{n} | Market dropdown
- Player rows for all 15 players (starting XI + bench)

#### Market Dropdown:
- To Score Anytime
- First Goalscorer
- 2 or More Goals
- Hat-trick
- To Get Assist
- Yellow Card
- Red Card

#### Per Player Row:
- Position badge (coloured: GK=gold, D=green, M=blue, F=red)
- Mini shirt SVG (32px)
- Player name + team name
- Fixture (e.g., "CHE (A)")
- **If fixture finished:** Result text based on market:
  - Anytime/First: "Scored" (green) or "No Goal" (grey)
  - 2+: "Scored {n}" or "No"
  - Hat-trick: "Hat-trick!" or "No"
  - Yellow Card: "Yellow Card" or "No Card"
  - Red Card: "Red Card" or "No Card"
  - Assists: "Assist ({n})" or "No Assist"
- **If fixture not finished + odds available:** Odds value (gold) + bookie logo
- **If no odds:** dash (—)

#### Odds Matching Logic:
- Matches player to odds store by: web_name, full name, last name
- Validates fixture match: odds fixture must involve player's team
- Team name variants handled: Spurs→Tottenham, Wolves→Wolverhampton, etc.

#### Bookie Logo Mapping:
- Images stored in `/public/logos/{bookie}.png`
- Lookup map handles variations (e.g., "livescorebet", "livescore" → same logo)
- Fallback: text badge if image fails to load

---

## 9. Player Detail Popup

Triggered by clicking any player tile on Team Points tab.

### UI (white card overlay):
1. **Header:** Total points in dark pill badge, player full name below
2. **Fixture + Score:** "Arsenal 2-1 Chelsea" with coloured score badge (purple=finished, green=live)
3. **xG and xA:** Side by side with bordered labels
4. **Points Breakdown Table:** Columns: Statistic | Value | Points
   - Minutes played, Goals scored, Assists, Clean sheets, Goals conceded
   - Yellow/Red cards, Saves, Bonus, etc.
   - Points coloured: green positive, red negative

### API: `/api/player-detail?id={elementId}&gw={gameweek}`

Returns:
```json
{
  "player": { "id": 1, "name": "Bukayo Saka", "webName": "Saka", "team": "Arsenal", "teamId": 1, "position": 3 },
  "totalPoints": 12,
  "xG": "0.85",
  "xA": "0.32",
  "fixture": { "home": "Arsenal", "away": "Chelsea", "homeScore": 2, "awayScore": 1, "finished": true, "minutes": 90 },
  "breakdown": [
    { "stat": "Minutes played", "value": 90, "points": 2 },
    { "stat": "Goals scored", "value": 1, "points": 5 },
    { "stat": "Assists", "value": 1, "points": 3 },
    { "stat": "Bonus", "value": 3, "points": 3 }
  ]
}
```

### Data Source:
- FPL `/api/event/{gw}/live/` — per-player stats + explain array
- Explain array gives exact points breakdown per fixture per stat

---

## 10. FPL Picks API (`src/pages/api/fpl-picks.js`)

### Parameters:
- `id` (required) — FPL Manager ID
- `gw` (optional) — gameweek number (defaults to current)

### Logic:
1. Fetch FPL bootstrap (all players, teams, current GW)
2. Fetch manager's picks for requested GW
3. If GW picks 404: fall back to previous GW's picks (for GW38 before it starts)
4. Fetch GW live data for real-time points
5. Fetch ALL fixtures and filter by requested GW (most reliable method for fixture matching)
6. Enrich each pick with: player data, team data, fixture, opponent, live status, goals/cards/assists

### Fixture Matching:
- Fetches all FPL fixtures, filters by `event == currentGW`
- Finds fixture where `team_h` or `team_a` matches player's team
- Determines home/away, opponent short name, fixture string (e.g., "CHE (A)")
- Detects live status: `started && !finished && !finished_provisional`

### Returns:
```json
{
  "gameweek": 37,
  "latestGW": 37,
  "active_chip": "3xc" | "bboost" | "wildcard" | "freehit" | null,
  "entry_history": { "points": 45, "rank": 12000, "overall_rank": 125000, "event_transfers": 1, "event_transfers_cost": 0 },
  "starting": [{ "element": 123, "position": 1, "multiplier": 2, "is_captain": true, ... }],
  "bench": [...]
}
```

### Per-Player Object:
```json
{
  "element": 123,
  "position": 1,
  "multiplier": 2,
  "is_captain": true,
  "is_vice_captain": false,
  "name": "Bukayo Saka",
  "web_name": "Saka",
  "element_type": 3,
  "pos_label": "MID",
  "team_name": "Arsenal",
  "team_short": "ARS",
  "team_id": 1,
  "fixture": "CHE (A)",
  "opponent": "CHE",
  "isHome": false,
  "fixtureFinished": true,
  "fixtureLive": false,
  "fixtureMinutes": 90,
  "goalsScored": 1,
  "yellowCards": 0,
  "redCards": 0,
  "assistsMade": 1,
  "event_points": 12,
  "total_points": 185,
  "photo": "123456.png"
}
```

### Caching:
- 2-minute TTL per `{managerId}-{gw}` combination

---

## 11. Livescorebet Odds Scraping (`src/pages/api/livescore-odds.js`)

### Endpoints Used:
- **League:** `https://gateway-uk.livescorebet.com/sportsbook/gateway/v3/view/events/matches?categoryid=SBTC3_40253&interval=ALL&lang=en-gb`
- **Event:** `https://gateway-uk.livescorebet.com/sportsbook/gateway/v1/view/event?eventid={id}&lang=en-gb`

### Required Headers:
```
Referer: https://www.livescorebet.com/uk/
Origin: https://www.livescorebet.com
```

### Flow:
1. Fetch league endpoint → get all EPL matches (NOTSTARTED or INPLAY)
2. For each match, fetch event endpoint → get all markets (99 per match)
3. Extract player odds from specific market names:
   - "Goalscorer" → anytime + firstGoal (by outcomeType or name prefix)
   - "To score at least 2 goals" → twoPlus
   - "To score at least 3 goals" → hatTrick
   - "To give an assist" → assists
   - "To Get a Card" → yellowCard
4. Store in memory with 3-hour TTL

### API Parameters:
- `GET /api/livescore-odds` — returns cached odds or fetches fresh
- `GET /api/livescore-odds?refresh=true` — forces fresh fetch

### Returns:
```json
{
  "odds": {
    "bukayo saka": {
      "name": "Bukayo Saka",
      "fixture": "Arsenal v Chelsea",
      "anytime": { "odds": "2.50", "bookie": "LivescoreBet" },
      "firstGoal": { "odds": "8.00", "bookie": "LivescoreBet" },
      "twoPlus": { "odds": "7.50", "bookie": "LivescoreBet" },
      "hatTrick": { "odds": "34.00", "bookie": "LivescoreBet" },
      "assists": { "odds": "3.20", "bookie": "LivescoreBet" },
      "yellowCard": { "odds": "4.50", "bookie": "LivescoreBet" }
    }
  },
  "lastFetched": "2025-05-17T15:00:00.000Z",
  "matches": ["Arsenal v Chelsea", "Man City v Liverpool", ...],
  "cached": false,
  "playerCount": 450
}
```

### Key Details:
- Free, unlimited, no API key required
- Processes ALL matches (no limit)
- `vercel.json` sets 60s `maxDuration` for this endpoint (Pro tier)
- In-memory cache only (resets on cold start)
- Odds keyed by lowercase player name

---

## 12. FPL Entry API (`src/pages/api/fpl-entry.js`)

Fetches live GW points for a manager, calculating from picks + live data when FPL's `summary_event_points` is stale.

### Logic:
1. Fetch manager entry data
2. If `summary_event_points` seems stale, fetch picks + live data
3. Calculate: `sum(starting XI live_points × multiplier) - hits`
4. Return whichever is higher (calculated vs FPL reported)

---

## 13. FPL Login API (`src/pages/api/login.js`)

Full FPL credential authentication flow (CSRF-based).

### Flow:
1. GET FPL login page → extract CSRF token from cookies
2. POST credentials with CSRF token
3. Check redirect location for success/failure
4. If successful, fetch `/api/me/` profile

### Notes:
- Handles cookie parsing across Node versions
- Returns manager's first/last name and entry ID on success
- Non-fatal errors (profile fetch fail) still return success

---

## 14. Price Changes Page (`src/pages/price-changes.js`)

Placeholder page with "Price change predictions coming soon" message. Structure ready for implementation.

---

## 15. Vercel Configuration (`vercel.json`)

```json
{
  "functions": {
    "src/pages/api/livescore-odds.js": {
      "maxDuration": 60
    }
  }
}
```

Required because scraping all EPL matches sequentially can take 30-50 seconds.

---

## 16. API Optimization & Caching Strategy

### Global Caches (in-memory, shared across requests):

| Cache | TTL | Purpose |
|-------|-----|---------|
| FPL Bootstrap | 30 min | All players, teams, events |
| FPL Fixtures | 2 min (live) / 30 min (idle) | Fixture stats for assists/BPS |
| Feed | 30s (live) / 5 min (idle) | Complete event feed |
| Match Details (finished) | 24 hours | Won't change |
| Match Details (live) | 30 seconds | Needs frequent updates |
| Match Details (upcoming) | 2 minutes | Lineups may appear |
| Fixtures per round | 30s (live) / 5 min (idle) | Scores update |
| FPL Picks | 2 minutes | Per manager+GW |
| Livescorebet Odds | 3 hours | Odds don't change rapidly |
| Player Position | Permanent (in-memory) | Name→position lookups |

### Estimated API-Football Call Reduction: 60-70%

### Feed Deduplication:
- Deterministic event IDs (no `Math.random()`)
- `seenIds` Set prevents duplicate events in response
- Same event from multiple API calls only appears once

---

## 17. FPL Team IDs (Verified from API)

```
1  = Arsenal
2  = Aston Villa
3  = Burnley
4  = Bournemouth
5  = Brentford
6  = Brighton
7  = Chelsea
8  = Crystal Palace
9  = Everton
10 = Fulham
11 = Leeds
12 = Liverpool
13 = Man City
14 = Man Utd
15 = Newcastle
16 = Nott'm Forest
17 = Sunderland
18 = Spurs
19 = West Ham
20 = Wolves
```

---

## 18. Team Name Mapping (Hardcoded, No Fuzzy Matching)

Used across feed.js, match-details.js for matching API-Football names to FPL names:

```javascript
const TEAM_NAME_MAP = {
  'arsenal': 'arsenal',
  'aston villa': 'aston villa',
  'bournemouth': 'bournemouth',
  'afc bournemouth': 'bournemouth',
  'brentford': 'brentford',
  'brighton': 'brighton',
  'brighton and hove albion': 'brighton',
  'chelsea': 'chelsea',
  'crystal palace': 'crystal palace',
  'everton': 'everton',
  'fulham': 'fulham',
  'ipswich': 'ipswich',
  'ipswich town': 'ipswich',
  'leicester': 'leicester',
  'leicester city': 'leicester',
  'liverpool': 'liverpool',
  'manchester city': 'man city',
  'manchester united': 'man utd',
  'newcastle': 'newcastle',
  'newcastle united': 'newcastle',
  'nottingham forest': "nott'm forest",
  'southampton': 'southampton',
  'tottenham': 'spurs',
  'tottenham hotspur': 'spurs',
  'west ham': 'west ham',
  'west ham united': 'west ham',
  'wolverhampton': 'wolves',
  'wolverhampton wanderers': 'wolves',
  'wolves': 'wolves',
};
```

**Critical rule:** No fuzzy/partial matching. "Manchester" must NOT match "Chelsea" (CHE appears in manCHEster). Only exact map lookups.

---

## 19. Bottom Navigation (Consistent Across All Pages)

```
⚽ Goals  |  👕 My Team  |  🏆 Leaderboard  |  📋 Matches  |  📈 Prices
```

- Fixed/sticky at bottom
- Active page highlighted in gold (#f5a623) with top border
- Max-width 480px, centered
- z-index: 9999 (above all content)
- "My Team" links to `/signin` if not logged in

---

## 20. Authentication Model

- **No server-side sessions** — purely client-side via localStorage
- User enters FPL Manager ID → stored as JSON in `localStorage('vidigoals_user')`
- All API calls pass `id` as query parameter
- Logout: removes localStorage item, redirects to home
- Optional: FPL credential login via `/api/login` (CSRF flow) — not required for core functionality

---

## 21. Responsive Design

- All pages: `max-width: 480px; margin: 0 auto;`
- Mobile-first — designed for phone screens
- Touch-friendly: large tap targets, no hover-dependent interactions
- Bottom nav uses `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation`
- Overflow handling: text-overflow ellipsis on team names, player names

---

## 22. Live Match Detection

A match is considered "live" if its status is one of:
```
['1H', '2H', 'HT', 'ET', 'P', 'BT']
```

A match is "finished" if:
```
['FT', 'AET', 'PEN']
```

Live indicators:
- Green pulsing dot in AppShell user bar
- Green "LIVE {minutes}'" badge on fixture rows
- Green pulsing points badge on player tiles
- "CURRENT ROUND ACTIVE" badge on Team Points page
- Pulsing dot next to GW Points value

---

## 23. Key Business Rules

1. **FPL is authoritative for assists** — never override with API-Football data
2. **Never exceed FPL's total assist count per player** (cap rule)
3. **Team name matching uses hardcoded map only** — no fuzzy/partial matching
4. **Goal points vary by position:** GK/DEF=+6, MID=+5, FWD=+4, Assist=+3
5. **GW points calculated live** from picks × multipliers, not stale FPL value
6. **Overall points = stored overall + live GW points** (FPL doesn't update overall during live)
7. **All times in Europe/London timezone**
8. **GW38 fallback:** If picks unavailable, use GW37 picks with GW38 fixtures and 0 points
9. **Predicted lineups:** Use team's last match lineup when official not available
10. **Livescorebet scraping is free/unlimited** — preferred over The Odds API (limited calls)

---

## 24. File Structure Summary

```
frontend/web-app/
├── package.json
├── vercel.json
├── public/
│   └── logos/
│       ├── livescorebet.png
│       ├── bet365.png
│       ├── betfair.png
│       └── ... (other bookie logos)
└── src/
    ├── components/
    │   └── AppShell.js
    └── pages/
        ├── _app.js
        ├── _document.js
        ├── index.js
        ├── vidiprinter.js
        ├── my-team.js
        ├── matches.js
        ├── price-changes.js
        ├── signin.js
        ├── leaderboard.js
        ├── settings.js
        └── api/
            ├── feed.js
            ├── fixtures.js
            ├── match-details.js
            ├── fpl-picks.js
            ├── fpl-entry.js
            ├── fpl-team.js
            ├── player-detail.js
            ├── livescore-odds.js
            ├── login.js
            ├── fetch-odds.js
            ├── player-odds.js
            ├── scrape-odds.js
            ├── assist-check.js
            └── debug-feed.js
```

---

## 25. Deployment & Infrastructure

- **Platform:** Vercel Pro ($20/month)
- **Region:** Default (auto)
- **Function timeout:** 60s for livescore-odds, 10s default for others
- **Git:** GitHub repo (Lloyd147, PRIVATE), pushes to main
- **Environment variables:** Set in Vercel dashboard
- **No database** — all caching is in-memory (resets on cold start/redeploy)
- **No cron jobs** — odds fetched on-demand with 3-hour cache

---

## 26. Multi-Country Odds Support

The Livescorebet scraping supports multiple countries with automatic geo-detection.

### Country Configuration:
```
UK:      gateway-uk.livescorebet.com, lang=en-gb, site=/uk/
Nigeria: gateway-ng.livescorebet.com, lang=en-ng, site=/ng/
```

### How it works:
1. Vercel sends `x-vercel-ip-country` header with every request (free, automatic)
2. API reads the country code and selects the correct gateway/lang
3. Odds are scraped from that country's Livescorebet instance
4. Deep links point to the correct country's site (e.g., `/ng/sports/...`)
5. Unsupported countries fall back to UK odds
6. Can override with `?country=ng` query param for testing
7. Separate in-memory cache per country (each with 3-hour TTL)

### Nigeria-specific:
- League endpoint: tries `events/matches` first, falls back to `coupon?id=3103`
- Event endpoint: same format as UK (`/v1/view/event?eventid={id}&lang=en-ng`)
- Event IDs are shared across countries (same `SBTE_2_` prefix)

### Adding new countries:
Add entry to `COUNTRY_CONFIG` with gateway, lang, sitePath, referer, and endpoint paths.

---

## 27. Odds Deep Linking

When a user taps the odds on the Player Odds tab, it opens Livescorebet in a new tab.

### URL Format:
```
https://www.livescorebet.com/{country}/sports/football/england-premier-league/{home}-{away}/{eventId}/?marketGroupId=213
```

### Implementation:
- `eventUrl` built during scraping from team names + event ID
- `selectionId` stored per selection (for future betslip pre-loading)
- Entire odds area (number + logo) is a single `<a>` tag with `target="_blank"`
- Country path adapts based on user's geo location

### Betslip Integration (not yet possible):
- Livescorebet doesn't support URL-based betslip pre-loading
- Selection IDs are stored (format: `SBTS_2_{id}`) for future use
- Their `calculatebets` endpoint uses POST with selection IDs
- If a bookie with URL betslip support is added later, IDs are ready

---

## 28. Price Changes Page (`src/pages/price-changes.js`)

Full price change prediction system with progress bars, speed indicators, and sortable columns.

### Layout:
- Search bar at top (filters by player name, team, position)
- Single scrollable list (highest + progress at top, lowest - at bottom)
- Sortable column headers (click to sort asc/desc)

### Columns:
| Column | Sortable | Description |
|--------|----------|-------------|
| Player | No | Shirt SVG + name + position/team |
| Fitness | No | Green dot (fit), ? (doubtful), + (injured), ! (suspended) |
| Price | Yes | Current FPL price (£) |
| Own% | Yes | Ownership percentage |
| Progress | Yes (default) | Progress bar + percentage badge (green for +, red for -) |
| Spd | Yes | Transfer speed per hour (▲0.2 green or ▼0.3 red) |
| Time | No | Estimated change time (Tonight, Tomorrow, < 2 days, > 2 days, etc.) |

### Progress Model:
```
threshold = BASE_FACTOR × (1 + ownership^0.55)
BASE_FACTOR = 65000

For seeded players:
  progress = seed_value + small_delta_from_transfers

For non-seeded players:
  progress = (net_transfers / threshold) × 100
```

### Seed Data:
- ~200 players hardcoded with FFF progress values as starting points
- Keyed by `web_name` (e.g., `'Doku': 100.1, 'Mitchell': 88.8`)
- Formula only adds tiny delta on top of seed (0.3 multiplier)
- Non-seeded players start at 0%

### Speed Calculation:
```
hourly_rate = |net_transfers| / 24 hours
speed = (hourly_rate / threshold) × 100
```
- Capped at 0.5, minimum 0.1
- Direction independent of riser/faller: based on whether transfers_in > transfers_out
- A faller can have ▲ speed (recovering) and a riser can have ▼ speed (slowing)

### Price Change Reset:
- Stores each player's last known price in memory
- On each poll, compares current price vs stored
- If price moved ±0.1 → player's progress resets to 0%
- Prevents showing 100% for a player who already changed

### Change Time Estimates:
- ≥95% → "Tonight"
- ≥80% → "Tomorrow"
- ≥60% → "< 2 days"
- ≥40% → "> 2 days"
- ≥25% → "> 3 days"
- <25% → "> 4 days"

### Caching:
- 15-minute TTL on the API response

---

## 29. API Protection (`src/lib/api-protection.js`)

Shared middleware for rate limiting and origin verification.

### Rate Limiting:
- 60 requests per minute per IP address
- In-memory store: `{ ip: { count, resetAt } }`
- Exceeding limit returns `429 Too Many Requests`
- Auto-cleanup of expired entries every 5 minutes

### Origin Check:
- Allowed origins: `vidigoals.com`, `www.vidigoals.com`, `localhost:3000/3001`, `*.vercel.app`
- Checks both `Origin` and `Referer` headers
- Requests with no origin/referer are allowed (server-side, curl)
- External scrapers with wrong origin get `403 Forbidden`

### Security Headers (added to every response):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### Protected Endpoints:
- `/api/feed`
- `/api/livescore-odds`
- `/api/price-changes`

### Usage:
```javascript
import { protect } from '../../lib/api-protection';
export default async function handler(req, res) {
  const blocked = protect(req, res);
  if (blocked) return;
  // ... handler logic
}
```

---

## 30. Authentication & Session Persistence

### Sign-in Flow:
1. User enters FPL Manager ID
2. Calls `/api/fpl-team` to verify and fetch team data
3. Stores user object in `localStorage('vidigoals_user')`
4. Stores ID separately in `localStorage('vidigoals_last_id')` (persists after logout)
5. Redirects to `/my-team`

### Persistent Login:
- User stays logged in until they explicitly log out
- If user visits `/signin` while logged in → auto-redirects to `/my-team`
- After logout: Team ID is pre-filled in the input for one-tap re-login
- `vidigoals_last_id` never gets cleared (even on logout)

### Overall Points (fixed):
- Uses `entry_history.total_points` from FPL picks endpoint
- This is FPL's own live-updating total (includes current GW)
- No double-counting with GW points
- Falls back to `user.overallPoints` from localStorage if API unavailable

---

## 31. Player Detail Caching

### Smart TTL:
- **Live match:** 2-minute cache (points updating)
- **Finished match:** 4-hour cache (data won't change)
- Keyed by `{playerId}-{gameweek}`
- Determines live/finished from fixture data in the response

---

## 32. File Structure (Updated)

```
frontend/web-app/
├── package.json
├── vercel.json
├── public/
│   └── logos/
│       ├── livescorebet.png
│       └── ... (other bookie logos)
└── src/
    ├── lib/
    │   └── api-protection.js    → Rate limiting + origin check middleware
    ├── components/
    │   └── AppShell.js          → Shared header, menu, points bar
    └── pages/
        ├── _app.js
        ├── _document.js
        ├── index.js
        ├── vidiprinter.js       → Live goal feed
        ├── my-team.js           → Team Points + Player Odds
        ├── matches.js           → Fixtures + match details
        ├── price-changes.js     → Price prediction with progress bars
        ├── signin.js            → FPL Manager ID login (with remember)
        ├── leaderboard.js       → (placeholder)
        ├── settings.js          → (placeholder)
        └── api/
            ├── feed.js          → Live event feed [PROTECTED]
            ├── fixtures.js      → GW fixtures
            ├── match-details.js → Match stats, lineups, BPS
            ├── fpl-picks.js     → Manager's team picks
            ├── fpl-entry.js     → Live GW points
            ├── fpl-team.js      → Manager lookup
            ├── player-detail.js → Player breakdown (2min/4hr cache)
            ├── livescore-odds.js → Multi-country odds scraping [PROTECTED]
            ├── price-changes.js → Price predictions [PROTECTED]
            ├── login.js         → FPL credential auth
            └── (debug/legacy endpoints)
```

---

## 33. Known Limitations / Future Work

- **Odds storage is in-memory** — lost on cold start. Plan: Vercel KV or Supabase
- **Single bookie** — only Livescorebet. Plan: 10 bookies with acca builder
- **No cron jobs** — scraping on-demand only. Plan: Vercel Cron every 3 hours
- **Price change model** — seeded from FFF snapshot, not tracking live deltas between polls
- **Betslip pre-loading** — not possible with Livescorebet (no URL-based betslip)
- **Leaderboard page** — placeholder only
- **No push notifications** — toggle exists but not wired
- **Red card market** — not yet extracted from Livescorebet
- **FPL 403 on Vercel** — intermittent blocking of Vercel's shared IPs by FPL. May need proxy (IPRoyal) if persistent
- **Duplicate player names** — "Anderson" exists for both Nott'm Forest and Sunderland; seed data may match wrong player

---

*End of Technical Specification*
