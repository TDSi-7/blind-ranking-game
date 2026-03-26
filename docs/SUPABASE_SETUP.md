# Supabase setup for Jones Games

To enable **Sign in with Google**, stats sync, and the Daily Challenge leaderboard, set up Supabase and wire it into the app.

---

## Quick checklist

1. **Create a project** at [supabase.com](https://supabase.com) → New project.
2. **Get URL + key**: Project Settings → API → copy **Project URL** and **anon public** key.
3. **Enable Google**: Authentication → Providers → Google → On. Create a Google OAuth client in [Google Cloud Console](https://console.cloud.google.com/) (Credentials → OAuth 2.0 Client ID, type Web application). Set redirect URI to `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`. Paste Client ID and Secret into Supabase.
4. **Configure app**: In `js/config.js` set `window.__SUPABASE_URL__` and `window.__SUPABASE_ANON_KEY__` (see `js/config.example.js`).
5. **Site URL**: Authentication → URL Configuration → set **Site URL** to `http://localhost:8000` for local dev (or your production URL).
6. **Database**: SQL Editor → New query → paste and run `supabase/migrations/001_initial_schema.sql` from this repo.

After that, the **Login** button (top right) will work and stats/daily leaderboard will sync.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. **New project**: choose organization, name, database password, region.
3. Wait for the project to be ready.

## 2. Get your project URL and anon key

1. In the Supabase dashboard, open **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## 3. Enable Google OAuth in Supabase

1. In the dashboard: **Authentication** → **Providers** → **Google**.
2. Turn **Enable Sign in with Google** on.
3. You need a **Google OAuth client**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
   - Create **OAuth 2.0 Client ID** (application type: **Web application**).
   - Add **Authorized redirect URIs**:  
     `https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback`  
     (use your Supabase project URL and path `/auth/v1/callback`).
   - Copy **Client ID** and **Client Secret** into Supabase Google provider (Client ID, Client Secret), then Save.

## 4. Configure the app

1. Open **`js/config.js`** in this repo.
2. Uncomment and set:
   - `window.__SUPABASE_URL__` = your Project URL
   - `window.__SUPABASE_ANON_KEY__` = your anon public key

Example:

```js
window.__SUPABASE_URL__ = 'https://abcdefgh.supabase.co';
window.__SUPABASE_ANON_KEY__ = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

3. **Do not commit real keys to git.** Add `js/config.js` to `.gitignore` if it contains secrets, and use `js/config.example.js` as a template.

## 5. Redirect URL for local development

- **Local**: Supabase redirects to the site URL you set in **Authentication** → **URL Configuration** → **Site URL**. For local dev, you can set it to `http://localhost:8000` (or the port you use). After sign-in, Google will redirect back to that URL.
- **Production**: Set **Site URL** to your deployed URL (e.g. `https://your-app.vercel.app`) and add the same URL under **Redirect URLs** if needed.

## 6. Database tables (for sync and Daily Challenge)

To enable **stats sync** and the **Daily Challenge** leaderboard, create the tables and RLS policies:

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Copy the contents of **`supabase/migrations/001_initial_schema.sql`** from this repo and run it.

This creates:

- **`profiles`** – display names (and avatar) for signed-in users; used for leaderboard.
- **`game_stats`** – per-user, per-game stats (blind-ranking, mimi-memory-chess) for sync.
- **`daily_challenge_completions`** – one row per user per day with completion time; leaderboard is read-only for dates you’ve completed.

## 7. Test

1. Serve the app (e.g. `python server.py` or open `index.html` via your dev server).
2. On the hub you should see **Sign in with Google** (if config is loaded).
3. Click it, complete Google sign-in; you should return to the hub as a signed-in user with **Sign out** visible.
4. Without a valid `config.js`, only guest mode is available and the Google button is hidden.

## 8. Optional: Vercel env vars

For production you can avoid putting keys in `config.js` by generating it at build time:

1. In Vercel: **Project** → **Settings** → **Environment Variables** add `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
2. In **Build & Development** set **Build Command** to something like:
   ```bash
   echo "window.__SUPABASE_URL__='$SUPABASE_URL';window.__SUPABASE_ANON_KEY__='$SUPABASE_ANON_KEY';" > js/config.js
   ```
   and **Output Directory** to the root (or wherever your static files are). Then your build produces a `config.js` with the env values. Alternatively use a small Node script that reads `process.env` and writes `js/config.js`.
