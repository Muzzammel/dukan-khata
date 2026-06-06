# 📒 Dukan Khata v4

iOS **Liquid-Glass** shop ledger. Upload register photo → Gemini AI extracts entries → saved to Supabase.

**Stack:** Next.js 14 · TypeScript · Supabase · Gemini 2.0 Flash (free) · Vercel

### ✨ New in v4 (redesign)
- **iPhone-style glass UI** — frosted glass cards, blur, vivid iOS accent colors, floating glass nav.
- **Automatic Light + Dark** — follows your phone's setting and can be flipped with the 🌙/☀️ button (choice is remembered). No flash on load.
- **Alive & animated** — count-up numbers on every stat, a live sales-trend sparkline, animated progress bars, springy button presses, page slide-in transitions, and a soft animated aurora background.
- **Richer dashboard** — net-profit hero, four stat tiles, order breakdown, top-expense card, and quick actions.

### 🚀 New in v4.1 (features)
- **Customers tab** — receivables grouped by customer, sorted by who owes most, with one-tap **Collect payment** (settles oldest dues first).
- **Mark as paid & payments** — settle any entry in one tap; per-customer running balance.
- **Search + filter** in the ledger (by invoice / customer) and an **Unpaid only** toggle.
- **Bulk actions** — multi-select entries to delete or mark paid.
- **Smarter AI scan** — every extracted row gets a **confidence score**; review and fix before saving (nothing is auto-written).
- **Refresh button** + **offline-first**: a service worker caches the app shell, and entries/expenses created offline are queued and auto-synced when you reconnect.
- **Currency = Qatari Riyal (QR)** everywhere; large numbers abbreviate (QR 1.2K / QR 3.4M) and expand to the full value on tap.
- **Edit expenses** (parity with entries), **loading skeletons**, **empty-state nudges** that jump to Scan, **error toasts** on every API failure, **rate-limited** scan endpoint, **WCAG-tuned** light mode, and `aria-label`s on icon buttons.
- **Tests** for the invoice A/D duplication rules: `npm test` (uses Node's built-in runner, no extra installs).

The data layer keeps your existing Supabase database and env vars. The only optional change: the scan flow now previews rows before saving (no migration needed).

---

## Run it locally
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # run the invoice-rule unit tests
```
(Requires the env vars below.)

---

## Quick Setup

### 1. Supabase
- Create project at supabase.com (free)
- SQL Editor → run `supabase/migrations/001_initial_schema.sql`
- SQL Editor → run `supabase/migrations/002_add_columns.sql`
- Settings → API → copy URL, anon key, service_role key

### 2. Gemini API Key (Free)
- aistudio.google.com → Get API Key → copy

### 3. Environment Variables
```bash
cp .env.local.example .env.local
```
Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
APP_SECRET=anyrandomword
```

### 4. Deploy to Vercel
```bash
git init && git add . && git commit -m "init" && git push
```
- Vercel → Import repo → Add all 5 env vars → Deploy
- Supabase → Auth → URL Configuration → Add `https://your-app.vercel.app/**`

### 5. Add to Phone Home Screen
- iPhone: Safari → Share → Add to Home Screen
- Android: Chrome → Menu → Add to Home Screen

---

## Features
- 📷 **AI Scan** — Gemini reads handwritten register photos
- 📋 **Ledger** — A (Advance) / D (Delivered) entries with auto-calculated due
- 💸 **Expenses** — 8 categories with donut chart breakdown
- 📊 **Dashboard** — Stats by Today / Week / Month / All Time, with live sparkline
- 🌗 **Light / Dark glass theme** — auto + manual toggle, remembered
- 🔒 **Per-user data** — Supabase RLS, each user sees only their shops
- 🏪 **Multi-shop** — Up to 5 shops per account

## Invoice Rules
- **Type A**: No duplicate invoice numbers allowed
- **Type D**: Duplicate allowed only if original invoice has remaining due balance

## Termux Workflow (Android)
```bash
cd ~/dukan-khata
git add .
git commit -m "changes"
git push
```
Vercel auto-deploys in ~2 minutes.
