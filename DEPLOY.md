# 🚀 Deploy Dukan Khata — GitHub · Supabase · Vercel

Follow these in order. The whole thing is free and takes ~20 minutes the first time.
Your project lives on your computer at `Desktop\Claude-Cowork\dukan-khata-v4`.

---

## STEP 1 — Supabase (your database + login)

1. Go to **https://supabase.com** → sign in → **New project**.
   - Pick a name (e.g. `dukan-khata`), set a database password (save it somewhere), choose the nearest region (e.g. **Middle East / Bahrain** for Qatar), click **Create**.
2. Wait ~2 minutes for it to finish provisioning.
3. In the left sidebar open **SQL Editor → New query**. Open the file
   `supabase/migrations/001_initial_schema.sql` from your project, copy **all** of it,
   paste into the editor, and click **Run**. You should see "Success".
4. Repeat with the second file: `supabase/migrations/002_add_columns.sql` → paste → **Run**.
5. Now get your keys: left sidebar **Project Settings (gear) → API**. Copy these three —
   you'll paste them into Vercel later:
   - **Project URL**  → goes into `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (click reveal) → goes into `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ Keep the service_role key secret — never share it or commit it.

---

## STEP 2 — Gemini API key (the AI scan, free)

1. Go to **https://aistudio.google.com/app/apikey** → sign in with Google.
2. Click **Create API key** → copy it. This is your `GEMINI_API_KEY`.

You now have 4 of the 5 values. The 5th, `APP_SECRET`, is just any random text you make up
(e.g. `dukan-qatar-2026-x7k9`).

---

## STEP 3 — Put the code on GitHub

You can use **GitHub Desktop** (easiest, no commands) or the **command line**.

### Option A — GitHub Desktop (recommended if you're not a developer)
1. Install **GitHub Desktop** from https://desktop.github.com and sign in.
2. **File → Add local repository** → choose your `dukan-khata-v4` folder.
   It will say "this isn't a git repository" → click **create a repository** → **Create**.
3. On the left you'll see all files listed. Type a summary like `first commit` → **Commit to main**.
4. Click **Publish repository** (top bar). Untick "Keep this code private" only if you want it public;
   private is fine. Click **Publish**.

### Option B — Command line (Git for Windows installed)
Open **PowerShell** in your project folder and run:
```powershell
cd "$HOME\Desktop\Claude-Cowork\dukan-khata-v4"
git init
git add .
git commit -m "Dukan Khata v4"
```
Then create an empty repo on **https://github.com/new** (name it `dukan-khata`, don't add a README),
and run the two lines GitHub shows you, which look like:
```powershell
git remote add origin https://github.com/YOUR-USERNAME/dukan-khata.git
git branch -M main
git push -u origin main
```

> ✅ Your `.gitignore` already excludes `.env.local` and `node_modules`, so your secret keys
> and big folders are **not** uploaded. Good.

---

## STEP 4 — Deploy on Vercel

1. Go to **https://vercel.com** → **Sign up / Log in with GitHub**.
2. Click **Add New… → Project** → find your `dukan-khata` repo → **Import**.
3. Vercel auto-detects **Next.js** — leave the build settings as-is.
4. Expand **Environment Variables** and add all **five** (Name → Value):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |
   | `GEMINI_API_KEY` | your Gemini key |
   | `APP_SECRET` | any random string you choose |

5. Click **Deploy**. Wait ~2 minutes. You'll get a live URL like
   `https://dukan-khata-xxxx.vercel.app`.

---

## STEP 5 — Tell Supabase about your live URL (so login works)

1. Back in Supabase: **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL: `https://dukan-khata-xxxx.vercel.app`
3. Under **Redirect URLs**, add: `https://dukan-khata-xxxx.vercel.app/**`
   (the `/**` matters — it allows all pages). Click **Save**.

---

## STEP 6 — Try it

1. Open your Vercel URL on your phone or computer.
2. Click **Sign Up**, create an account with email + password (min 6 chars).
3. Log in → you'll land on the dashboard. Add an entry or scan a register page.
4. On iPhone: Safari **Share → Add to Home Screen** to install it like an app.
   On Android: Chrome **⋮ → Add to Home Screen**.

---

## Making changes later
Every time you change the code:
- **GitHub Desktop:** commit → **Push origin**.
- **Command line:** `git add . && git commit -m "update" && git push`

Vercel automatically rebuilds and redeploys within ~2 minutes. No manual step needed.

---

## If something goes wrong
- **Login email never arrives / redirect error** → re-check STEP 5 (Site URL + Redirect `/**`).
- **"DB error — run migration SQL"** in the app → you missed STEP 1.3 or 1.4; re-run both SQL files.
- **AI scan fails** → check `GEMINI_API_KEY` is set in Vercel (Settings → Environment Variables),
  then **Redeploy** (Deployments → ⋯ → Redeploy).
- **Build failed on Vercel** → open the build log, copy the error, and I can fix it.
- After changing any env var in Vercel you must **Redeploy** for it to take effect.
