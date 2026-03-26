-- Fix daily leaderboard visibility: previous SELECT policy could result in users only seeing
-- their own completion row. This allows all authenticated users to read leaderboard rows.

DROP POLICY IF EXISTS "Users can read leaderboard for dates they completed"
    ON public.daily_challenge_completions;

DROP POLICY IF EXISTS "Authenticated users can read daily leaderboard"
    ON public.daily_challenge_completions;

CREATE POLICY "Authenticated users can read daily leaderboard"
    ON public.daily_challenge_completions FOR SELECT
    USING (auth.role() = 'authenticated');
