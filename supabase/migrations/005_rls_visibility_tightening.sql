-- Tighten visibility to logged-in users for profile and daily records related reads.

DROP POLICY IF EXISTS "Profiles are viewable by everyone"
    ON public.profiles;

DROP POLICY IF EXISTS "Authenticated users can view profiles"
    ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can read leaderboard for dates they completed"
    ON public.daily_challenge_completions;

DROP POLICY IF EXISTS "Authenticated users can read daily leaderboard"
    ON public.daily_challenge_completions;

CREATE POLICY "Authenticated users can read daily leaderboard"
    ON public.daily_challenge_completions FOR SELECT
    USING (auth.role() = 'authenticated');
