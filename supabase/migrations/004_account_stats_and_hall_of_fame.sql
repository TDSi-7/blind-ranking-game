-- Account stats, daily ranking views, and hall of fame functions.

CREATE OR REPLACE VIEW public.daily_challenge_rankings AS
SELECT
    d.date,
    d.user_id,
    d.display_name,
    d.score,
    d.completion_time_seconds,
    d.completed_at,
    ROW_NUMBER() OVER (
        PARTITION BY d.date
        ORDER BY d.score DESC, d.completion_time_seconds ASC, d.completed_at ASC
    ) AS rank_position
FROM public.daily_challenge_completions d;

CREATE OR REPLACE VIEW public.user_daily_challenge_summary AS
SELECT
    r.user_id,
    COUNT(*)::int AS challenges_played,
    COUNT(*) FILTER (WHERE r.rank_position = 1)::int AS first_count,
    COUNT(*) FILTER (WHERE r.rank_position = 2)::int AS second_count,
    COUNT(*) FILTER (WHERE r.rank_position = 3)::int AS third_count,
    ROUND(AVG(r.rank_position)::numeric, 2) AS average_position,
    (
        COUNT(*) FILTER (WHERE r.rank_position = 1) * 3
        + COUNT(*) FILTER (WHERE r.rank_position = 2) * 2
        + COUNT(*) FILTER (WHERE r.rank_position = 3)
    )::int AS points
FROM public.daily_challenge_rankings r
GROUP BY r.user_id;

CREATE OR REPLACE VIEW public.hall_of_fame_points AS
SELECT
    p.id AS user_id,
    p.display_name,
    COALESCE(s.first_count, 0) AS first_count,
    COALESCE(s.second_count, 0) AS second_count,
    COALESCE(s.third_count, 0) AS third_count,
    COALESCE(s.points, 0) AS points,
    COALESCE(s.average_position, 0)::numeric(10,2) AS average_position
FROM public.profiles p
LEFT JOIN public.user_daily_challenge_summary s
    ON s.user_id = p.id;

CREATE OR REPLACE FUNCTION public.get_hall_of_fame(max_rows int DEFAULT 100)
RETURNS TABLE (
    rank_position int,
    user_id uuid,
    display_name text,
    first_count int,
    second_count int,
    third_count int,
    points int,
    average_position numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ROW_NUMBER() OVER (
            ORDER BY h.points DESC, h.first_count DESC, h.second_count DESC, h.third_count DESC, h.display_name ASC
        )::int AS rank_position,
        h.user_id,
        h.display_name,
        h.first_count,
        h.second_count,
        h.third_count,
        h.points,
        h.average_position
    FROM public.hall_of_fame_points h
    WHERE (h.first_count + h.second_count + h.third_count) > 0
    ORDER BY h.points DESC, h.first_count DESC, h.second_count DESC, h.third_count DESC, h.display_name ASC
    LIMIT GREATEST(1, COALESCE(max_rows, 100));
$$;

CREATE OR REPLACE FUNCTION public.get_my_account_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH me AS (
    SELECT auth.uid() AS user_id
),
profile_data AS (
    SELECT p.id AS user_id, p.display_name
    FROM public.profiles p
    JOIN me ON me.user_id = p.id
),
blind AS (
    SELECT gs.stats
    FROM public.game_stats gs
    JOIN me ON me.user_id = gs.user_id
    WHERE gs.game_id = 'blind-ranking'
),
mimi AS (
    SELECT gs.stats
    FROM public.game_stats gs
    JOIN me ON me.user_id = gs.user_id
    WHERE gs.game_id = 'mimi-memory-chess'
),
game_rollup AS (
    SELECT
        COALESCE(SUM(COALESCE((gs.stats->'playerStats'->>'gamesPlayed')::int, gs.stats->>'gamesPlayed', '0')::int), 0)::int AS total_games_played,
        COALESCE(
            jsonb_object_agg(
                gs.game_id,
                COALESCE((gs.stats->'playerStats'->>'gamesPlayed')::int, gs.stats->>'gamesPlayed', '0')::int
            ),
            '{}'::jsonb
        ) AS games_played_by_game
    FROM public.game_stats gs
    JOIN me ON me.user_id = gs.user_id
)
SELECT jsonb_build_object(
    'display_name', COALESCE((SELECT display_name FROM profile_data), 'Player'),
    'games_played_total', (SELECT total_games_played FROM game_rollup),
    'games_played_by_game', (SELECT games_played_by_game FROM game_rollup),
    'games_played_games', (
        SELECT COALESCE(jsonb_agg(key ORDER BY key), '[]'::jsonb)
        FROM jsonb_each((SELECT games_played_by_game FROM game_rollup))
        WHERE (value::text)::int > 0
    ),
    'blind_ranking', jsonb_build_object(
        'high_scores', COALESCE((SELECT stats->'highScores' FROM blind), '{}'::jsonb),
        'overall_average_score', COALESCE(
            ROUND(
                ((SELECT (stats->'playerStats'->>'totalScore')::numeric FROM blind)
                / NULLIF((SELECT (stats->'playerStats'->>'gamesPlayed')::numeric FROM blind), 0)),
                2
            ),
            0
        ),
        'overall_high_score', COALESCE((SELECT (stats->'playerStats'->>'highScore')::int FROM blind), 0),
        'difficulty', COALESCE((SELECT stats->'playerStats'->'byDifficulty' FROM blind), '{}'::jsonb)
    ),
    'daily_challenge', jsonb_build_object(
        'challenges_played', COALESCE((SELECT challenges_played FROM public.user_daily_challenge_summary s JOIN me ON me.user_id = s.user_id), 0),
        'first_count', COALESCE((SELECT first_count FROM public.user_daily_challenge_summary s JOIN me ON me.user_id = s.user_id), 0),
        'second_count', COALESCE((SELECT second_count FROM public.user_daily_challenge_summary s JOIN me ON me.user_id = s.user_id), 0),
        'third_count', COALESCE((SELECT third_count FROM public.user_daily_challenge_summary s JOIN me ON me.user_id = s.user_id), 0),
        'average_position', COALESCE((SELECT average_position FROM public.user_daily_challenge_summary s JOIN me ON me.user_id = s.user_id), 0),
        'points', COALESCE((SELECT points FROM public.user_daily_challenge_summary s JOIN me ON me.user_id = s.user_id), 0)
    )
);
$$;

GRANT SELECT ON public.daily_challenge_rankings TO authenticated;
GRANT SELECT ON public.user_daily_challenge_summary TO authenticated;
GRANT SELECT ON public.hall_of_fame_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hall_of_fame(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_account_stats() TO authenticated;
