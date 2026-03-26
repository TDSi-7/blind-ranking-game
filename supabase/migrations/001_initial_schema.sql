-- Jones Games: profiles, game_stats, daily_challenge_completions
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).

-- Public profile (display name for leaderboards). Synced from auth on login.
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL DEFAULT 'Player',
    avatar_url text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: anyone can read (for leaderboard names); users manage own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Per-user, per-game stats (free play). JSONB holds game-specific structure.
CREATE TABLE IF NOT EXISTS public.game_stats (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    game_id text NOT NULL,
    stats jsonb NOT NULL DEFAULT '{}',
    last_played_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id)
);

ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own game_stats"
    ON public.game_stats FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game_stats"
    ON public.game_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own game_stats"
    ON public.game_stats FOR UPDATE USING (auth.uid() = user_id);

-- Daily challenge completions. One row per user per day; best time kept.
CREATE TABLE IF NOT EXISTS public.daily_challenge_completions (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    score int NOT NULL DEFAULT 0,
    completion_time_seconds int NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    display_name text NOT NULL DEFAULT 'Player',
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, date)
);

ALTER TABLE public.daily_challenge_completions ENABLE ROW LEVEL SECURITY;

-- Users can insert/update their own row for a given date (upsert keeps best time)
CREATE POLICY "Users can insert own daily completion"
    ON public.daily_challenge_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily completion"
    ON public.daily_challenge_completions FOR UPDATE USING (auth.uid() = user_id);

-- Users can read rows only for dates they have completed (so they can see that day's leaderboard)
CREATE POLICY "Users can read leaderboard for dates they completed"
    ON public.daily_challenge_completions FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.daily_challenge_completions d2
            WHERE d2.date = daily_challenge_completions.date
              AND d2.user_id = auth.uid()
        )
    );

-- Backfill score when running against an existing table created before this column existed.
ALTER TABLE public.daily_challenge_completions
    ADD COLUMN IF NOT EXISTS score int NOT NULL DEFAULT 0;

-- Index for daily records query (score DESC, then duration ASC).
CREATE INDEX IF NOT EXISTS idx_daily_challenge_date_score_time
    ON public.daily_challenge_completions (date, score DESC, completion_time_seconds ASC);
