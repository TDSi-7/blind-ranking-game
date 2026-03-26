-- Admin tools for daily challenge reset.
-- This creates an explicit admin allowlist and secure RPC functions.

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own admin row"
    ON public.admin_users FOR SELECT
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users a
        WHERE a.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_daily_challenge(target_date date DEFAULT (now() AT TIME ZONE 'utc')::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count integer;
BEGIN
    IF NOT public.is_current_user_admin() THEN
        RAISE EXCEPTION 'Only super admins can reset daily challenge results.';
    END IF;

    DELETE FROM public.daily_challenge_completions
    WHERE date = target_date;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_daily_challenge(date) TO authenticated;
