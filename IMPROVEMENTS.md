# 💡 Dukan Khata — Ideas to make it even better

You asked what you could improve. Here are concrete, high-impact ideas, grouped by effort. The redesign already delivered the iOS-glass theme, light/dark, animated dashboard, and a sales-trend sparkline. These are the next steps.

## Quick wins (a few hours each)
- **Customer due-tracker view.** You already store `customer_name` and `due`. Add a "Customers" tab that groups outstanding dues by customer and shows who owes the most — shopkeepers care about this more than anything.
- **Search + filter in the ledger.** A search box (by invoice / customer) and a "Only show unpaid" toggle. With many entries the current scroll gets long.
- **Pull-to-refresh / refresh button.** Right now data loads on tab/period change only. A manual refresh helps when entered on another device.
- **Empty-state nudges.** When a shop has no data, suggest "Scan your register to get started" with a single tap to the Scan tab (partly done — can go further).
- **Currency + number formatting polish.** Large amounts as `₹1.2L` / `₹3.4Cr` for quick reading, full value on tap.

## Medium effort (a day or two)
- **Export & share.** "Export this month" → CSV or a clean PDF statement per shop/customer. Great for sharing on WhatsApp.
- **Charts over time.** A small monthly bar chart of sales vs expenses (the sparkline is a first step). Helps spot trends.
- **Edit expenses.** Entries are editable; expenses are currently delete-only. Add edit parity.
- **Offline-first / PWA caching.** It's already installable. Add a service worker so it opens instantly and queues entries when the network drops — common in shops with patchy signal.
- **Bulk actions.** Multi-select entries to delete or mark paid.

## Bigger bets (worth planning)
- **Payments & "mark as paid".** Let a `D` entry settle an `A` due, with a running balance per customer. This turns the ledger into a real receivables tool.
- **WhatsApp reminders.** "₹X due since 12 days" auto-message to a customer via the WhatsApp Business API.
- **Roles / staff accounts.** Let a shop owner add a worker with entry-only access.
- **Voice / multi-language entry.** Hindi/Urdu/regional voice input for amounts — faster than typing for many users.
- **Smarter AI scan.** Show a confidence score per extracted row and let the user confirm/fix before saving, reducing bad data from messy handwriting.

## Technical / quality
- **Validation & error toasts** on the API responses (some failures pass silently).
- **Loading skeletons** instead of a single spinner (the design system already has a `.shimmer` class ready to use).
- **Rate-limit the extract endpoint** so a stuck upload can't burn Gemini quota.
- **Tests** for the invoice-duplication rules (Type A / Type D) — they're business-critical and easy to break.
- **Accessibility pass** — the glass theme looks great; double-check text contrast in light mode and add `aria-label`s to icon-only buttons.

## My top 3 if you only do three
1. **Customer due-tracker** (the feature shopkeepers will love most).
2. **Export / share to WhatsApp** (daily real-world use).
3. **"Mark as paid" / receivables** (turns a log into a tool).
