# Design: Auth, Free Play, Daily Challenge & Database

This document outlines the architecture for adding **Google Auth**, **Free Play** vs **Daily Challenge** modes, and a **database** for users, stats, and leaderboards.

---

## 1. Overview

| Feature | Description |
|--------|-------------|
| **Google Auth** | Sign in with Google; one account per user. |
| **Free Play** | Existing games (Blind Ranking, Mimi's Memory Chess) playable anytime, no login required for local play; optional login to sync stats. |
| **Daily Challenge** | One Blind Ranking challenge per 24h, same for everyone; leaderboard by completion time, visible only after you complete it. |
| **Database** | Store users, game stats, daily challenge results, and achievements. |

---

## 2. Recommended Tech Choices

- **Auth + Backend + DB**: Use **Supabase** (or **Firebase**).
  - **Supabase**: PostgreSQL, Row Level Security, Auth (Google OAuth), Edge Functions or direct REST. Good fit for leaderboards and complex queries.
  - **Firebase**: Firestore + Firebase Auth (Google). Simpler if you prefer NoSQL and Firebase SDK.
- **Recommendation**: **Supabase** for structured leaderboards, daily challenge “seed” storage, and flexible stats/achievements.

---

## 3. Google Auth (Login / Create Account)

- **Flow**: “Sign in with Google” on the hub (and optionally on game pages). On success, create or link a **user** record in the database.
- **Implementation**:
  - **Supabase**: Supabase Auth with Google provider; user id = `auth.uid()`.
  - **Firebase**: Firebase Auth with Google sign-in; user id = `user.uid`.
- **UX**:
  - Show “Sign in with Google” and “Continue as guest” (optional). Guest = current localStorage profile only; no sync.
  - Once signed in: show avatar/name, “Sign out”, and sync stats to DB.
- **Linking**: If user was playing as guest, you can offer “Link this device to your account” so existing localStorage stats are merged into their account (one-time migration).

---

## 4. Free Play Mode

- **Definition**: The current behaviour of **Blind Ranking** and **Mimi's Memory Chess** — play anytime, choose difficulty, unlimited games.
- **Changes**:
  - **Hub**: Label these as “Free Play” (e.g. “Blind Ranking – Free Play”, “Mimi's Memory Chess – Free Play”) and keep links to `blind-ranking/index.html` and `mimi-memory-chess/index.html`.
  - **Optional**: Add a separate entry point for “Daily Challenge” (see below) so the hub shows two “Blind Ranking” entries: “Free Play” and “Daily Challenge”.
- **Persistence**:
  - **Guest**: Keep using `js/profiles.js` + localStorage (no DB).
  - **Logged-in**: After each game (or on interval), sync stats to the database (see schema below) so they’re available on any device.

---

## 5. Daily Challenge (Wordle-style Blind Ranking)

### 5.1 Behaviour

- **One challenge per 24 hours** (e.g. midnight UTC, or another fixed timezone).
- **Same challenge for everyone**: Same sequence of 10 numbers (1–100, or fixed range), same order.
- **Leaderboard**: Who completed it and **how quickly** (e.g. time in seconds from first “Next” to placing the 10th number). Only visible **after** you have completed that day’s challenge (and optionally only for that day’s challenge).
- **Completion**: “Completed” = placed all 10 numbers (perfect 10/10). If you fail (game over before 10), you can retry the same day’s challenge until you complete it; only the **best time** (or first completion time, depending on product choice) is stored.

### 5.2 Same Challenge for Everyone

Two options:

1. **Server-defined sequence (recommended)**  
   - Backend stores “today’s challenge” as a fixed list of 10 numbers (e.g. `[17, 3, 45, …]`).  
   - Client fetches this list at start of daily challenge and uses it instead of `Math.random()`.  
   - Guarantees identical experience and is easy to reason about.

2. **Seeded RNG**  
   - Backend stores a **date-based seed** (e.g. `YYYY-MM-DD` or hash of it).  
   - Client has a seeded PRNG (e.g. mulberry32) and generates the same 10 numbers from that seed.  
   - No need to store the list on the server, but you must implement and maintain the seeded RNG.

**Recommendation**: Use (1) and generate the daily sequence in a **scheduled job** (e.g. Supabase Edge Function on cron, or external cron calling an API) that writes the next day’s sequence into a table. Client then fetches “today’s challenge” by date.

### 5.3 Implementation Outline

- **New route/page**: e.g. `daily-challenge/index.html` (or `blind-ranking-daily/index.html`).
- **Logic**: Reuse `BlindRankingGame` (or a fork) but:
  - **No difficulty choice**; range fixed (e.g. 1–100).
  - **Numbers** come from the API (today’s sequence) instead of `generateNextNumber()` with `Math.random()`.
  - **Timer**: Start when the user sees the first number (or on “Start”); end when the 10th number is placed. Send `completionTimeSeconds` to the backend.
- **API**:
  - `GET /api/daily-challenge?date=YYYY-MM-DD` → returns `{ numbers: [1..10], date }` (or just for “today”).
  - `POST /api/daily-challenge/submit` → body: `{ date, completionTimeSeconds }`; server associates with `user_id` and upserts best time for that date.
  - `GET /api/daily-challenge/leaderboard?date=YYYY-MM-DD` → returns list of completions (e.g. rank, display name, time); **only allowed** if the requesting user has completed that date (check in backend).
- **Leaderboard visibility**: Backend checks “has this user completed this date?” before returning leaderboard; frontend only shows “Complete the challenge to see the leaderboard” until then.

---

## 6. Database Schema (Supabase / PostgreSQL)

### 6.1 Core Tables

**`users`** (can be synced from Supabase Auth via trigger or app logic)

- `id` (uuid, PK) — from `auth.users.id`
- `email` (text, nullable)
- `display_name` (text) — from Google profile or editable
- `avatar_url` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

**`profiles`** (optional: if you keep “profiles” as sub-accounts under one login)

- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `name` (text) — “Player 1”, “Alex”, etc.
- `created_at`

For simplicity, you can start with **one profile per user** (display_name = main name) and add multiple profiles later.

**`game_stats`** (per-user, per-game aggregate stats)

- `user_id` (uuid, FK)
- `game_id` (text) — e.g. `'blind-ranking'`, `'mimi-memory-chess'`
- `games_played` (int, default 0)
- `blind_ranking` JSONB nullable — e.g. `{ "highScores": { "easy": {...}, "medium": {...}, "hard": {...} }, "playerStats": { "totalScore", "highScore", "scores": [] } }`
- `mimi_memory_chess` JSONB nullable — e.g. `{ "wins", "circlesWon", "gamesPlayed" }`
- `last_played_at` (timestamptz)
- `created_at`, `updated_at`
- UNIQUE(user_id, game_id)

**`daily_challenges`** (the daily number sequence)

- `date` (date, PK) — e.g. `2025-03-15`
- `numbers` (int[] or JSONB) — length 10, e.g. `[17, 3, 45, 22, 88, 5, 61, 33, 91, 12]`
- `created_at` (timestamptz)

**`daily_challenge_completions`** (one row per user per day; best time)

- `user_id` (uuid, FK)
- `date` (date)
- `completion_time_seconds` (int) — from first number to 10th placed
- `completed_at` (timestamptz) — when they finished
- `created_at`, `updated_at`
- UNIQUE(user_id, date)
- On conflict: update only if new `completion_time_seconds` is better (lower).

**`achievements`** (definition table)

- `id` (text, PK) — e.g. `'first_10_blind_ranking'`, `'daily_streak_7'`
- `name` (text)
- `description` (text)
- `icon` (text, optional) — emoji or URL

**`user_achievements`**

- `user_id` (uuid, FK)
- `achievement_id` (text, FK)
- `unlocked_at` (timestamptz)
- UNIQUE(user_id, achievement_id)

### 6.2 Indexes

- `game_stats(user_id, game_id)` (already unique)
- `daily_challenge_completions(date, completion_time_seconds)` for leaderboard queries
- `daily_challenge_completions(user_id, date)` for “has user completed this date?”

### 6.3 Row Level Security (Supabase)

- **users**: Users can read/update their own row.
- **game_stats**: Users can read/update their own rows.
- **daily_challenges**: Everyone can read; only backend/cron can insert/update.
- **daily_challenge_completions**: Users can insert their own; read only for dates they’ve completed (enforce in RLS or in API).
- **user_achievements**: Users can read their own; only backend (or app logic) inserts.

---

## 7. Stats to Store (and Sync from Client)

### 7.1 Already in Use (to migrate/sync)

- **Blind Ranking (free play)**  
  - Per difficulty: high score, perfect games (10/10) count.  
  - Player stats: games played, total score, high score, recent scores (optional array).
- **Mimi's Memory Chess**  
  - Games played, wins, circles won.

### 7.2 Additional Stats to Consider

- **Cross-game**
  - **Total games played** (all games).
  - **Last played at** (per game and overall).
  - **Total play time** (optional: cumulative seconds in-game; requires client to send session length).
- **Blind Ranking**
  - **Average score** (derivable from total score / games played).
  - **Best streak** of perfect 10/10s (e.g. 3 days in a row in daily; or 3 free-play games in a row).
  - **Number of “almost” games** (e.g. 9/10) if you want “so close” achievements.
- **Daily Challenge**
  - **Completion count** (how many daily challenges completed).
  - **Current streak** (consecutive days completed).
  - **Longest streak**.
  - **Best rank** ever (e.g. “Top 10”).
  - **Average completion time** (over last 30 days or all time).

Store these either as **columns** on `game_stats` / a dedicated `user_daily_stats` table, or inside the existing JSONB blobs with a clear schema so you can query/aggregate later.

---

## 8. Achievements (Suggestions)

- **Blind Ranking (free play)**  
  - First perfect 10/10 (any difficulty).  
  - Perfect 10/10 on Easy / Medium / Hard.  
  - 5 / 10 / 25 perfect games total.  
  - High score 10 on Hard.  
  - “Almost”: 9/10 on Hard.
- **Mimi's Memory Chess**  
  - First win.  
  - 5 / 10 / 25 wins.  
  - Win with 25 circles (or your “full board” size).  
  - Win on Hard.
- **Daily Challenge**  
  - Complete first daily challenge.  
  - 7-day streak.  
  - 30-day streak.  
  - Top 10 on a day.  
  - Complete in under 60 seconds (or another threshold).
- **General**  
  - Create account (or “Sign in with Google”).  
  - Play all games at least once.  
  - Play 10 / 50 / 100 games total (any game).

You can add more later; the `achievements` + `user_achievements` tables support any list.

---

## 9. Implementation Order

1. **Supabase project**: Create project, enable Google Auth, add tables above (+ RLS).
2. **Auth on hub**: Add “Sign in with Google” and “Sign out”; show logged-in state; optional “Continue as guest”.
3. **Sync free-play stats**: When user is logged in, after each game (or on hub load) sync localStorage stats to `game_stats` (merge/upsert); on load, optionally overwrite localStorage from DB so other devices’ progress is reflected.
4. **Daily challenge backend**: Table `daily_challenges`; cron or Edge Function to generate and insert next day’s sequence; API to get today’s numbers and to submit completion + fetch leaderboard (with “completed?” check).
5. **Daily challenge frontend**: New page; reuse Blind Ranking logic with API-driven numbers and timer; submit time on success; show leaderboard after completion.
6. **Hub**: Add “Daily Challenge” card; label existing Blind Ranking and Mimi as “Free Play”.
7. **Achievements**: Backend logic to grant achievements when stats hit thresholds; achievements table + user_achievements; optional “Achievements” section on hub or profile.

---

## 10. Summary

- **Login**: Google Auth via Supabase (or Firebase); optional guest.
- **Free play**: Current games, labeled as “Free Play”; stats in localStorage for guests, synced to DB when logged in.
- **Daily challenge**: One Blind Ranking per day, same numbers for everyone; leaderboard by completion time; visible only after you complete that day.
- **Database**: Users, game_stats (with JSONB for flexible per-game stats), daily_challenges, daily_challenge_completions, achievements, user_achievements.
- **Extra stats**: Streaks, totals, averages, best rank; **achievements** for firsts, streaks, milestones, and “almost” moments.

If you want to proceed, the next step is implementing Supabase (or Firebase) and the auth flow on the hub, then free-play sync, then daily challenge API and UI.
