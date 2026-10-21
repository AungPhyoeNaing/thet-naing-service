# Thet Naing Service

A responsive workshop application for home appliance and industrial machine repair. Track a service request through diagnosis, estimate approval, parts issue, repair, quality checks, payment and collection.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite. To validate a production build:

```sh
npm test
npm run build
npm run preview
```

If the Windows npm shim fails in an automated terminal, use `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"` in place of `npm`.

## Reference and isolation

La Min Clinic (`C:\Users\stephen\Desktop\La Min Clinic`) was used as a read-only reference for the stack and structure:

- React 19 + TypeScript 6 + Vite 8.
- Tailwind 4, Public Sans, Noto Sans Myanmar and Lucide icons.
- React Router, app providers, feature screens, repository interfaces and library helpers.
- Browser-local storage by default, optional Supabase Auth/Postgres/RLS.
- Installable PWA, cached app shell, Vitest and PGlite schema tests.

This project has independent source, branding, database schema, hosting identity, browser storage (`thet-naing.workshop.v1`) and auth session (`thet-naing.auth.v1`). No clinic environment files, records, credentials, artwork or runtime data were copied. The dependency manifest and lockfile retain the reference stack. The UI is English and accepts Unicode customer names and notes, including Burmese.

## Features

- Overview with a repair board, board/list switching, search, category, priority, technician and status filters.
- Intake with customer contact/location, equipment/model/serial, problem, workshop/on-site service, priority and target date.
- Technician assignment, diagnosis, repair notes and dated activity history.
- Editable estimates with inventory-linked parts and labour. Print estimates or use the browser's Save as PDF option.
- Staff record that an estimate was shared and whether the customer approved or declined. The app does not send messages.
- Approval atomically issues quoted stock. Duplicate part lines are aggregated before checking stock. Approved estimates are locked to prevent duplicate issue or price changes after approval.
- Three quality checks gate readiness. Full payment and readiness gate collection. Payments are records of money received; there is no online payment processing.
- Parts catalogue with opening balances, selling prices, reorder minimums, shelf locations, part editing, receipts and low-stock alerts.
- Customer histories grouped by name and phone.
- Reports, technician workloads, equipment mix and CSV exports. Report dates select jobs by receipt date; payment figures are amounts recorded on those jobs to date.
- Technician management, JSON backup/restore with validation and confirmation, and a confirmed fresh start from sample data.
- Myanmar kyat (Ks), Asia/Rangoon dates, keyboard focus, native modal focus trapping, responsive navigation and swipeable mobile board lanes.

### Local mode

No configuration is needed. On first use the app creates clearly labeled fictional sample records. Settings → Start an empty workshop removes the sample jobs and parts after confirmation and keeps the technician list. Backups include all records, quotes, payments, stock and history.

Local mode saves on the current browser/device. It does not sync across devices and does not provide a staff login. Back up before clearing site data. Storage writes are checked by revision and use Web Locks where available; errors retain the prior state. Damaged storage is never silently replaced and can be exported from the recovery screen.

### Optional shared Supabase mode

Use a **new Supabase project dedicated to this repair shop**. Do not reuse the clinic project or its keys.

1. Run `supabase/schema.sql` in the new project's SQL Editor. It is rerunnable and preserves an existing workshop.
2. Disable public sign-ups in Supabase Auth. Create staff users manually in Auth → Users.
3. Approve each staff user using the SQL shown at the end of the schema. Only approved staff can read or save workshop data. Signing in alone is insufficient.
4. Copy `.env.example` to `.env.local` and fill in the new project URL and public anon/publishable key. Never put a service-role key in a Vite variable.
5. Restart Vite or rebuild and redeploy. Cloud mode shows a real staff sign-in screen and starts with an empty shared workshop. It does not automatically upload local records. To migrate local records, export a JSON backup and explicitly restore it into the cloud workspace.

Cloud storage uses a single versioned workshop snapshot suitable for a small workshop. `save_workshop` locks the row, checks approved staff and expected revision, then commits the snapshot in one transaction. Direct client writes are revoked. Stale saves are rejected; refresh before retrying. The app checks cloud changes every 30 seconds and on window focus. Cloud writes need a connection and are not queued offline. Export backups regularly. A restore replaces the shared snapshot for all staff after confirmation.

Cloud SQL authorization and revision checks are exercised against PGlite with mocked Supabase roles. A real Supabase deployment and production sign-in require your new project and have not been provisioned by this task.

## Structure

```text
src/
  app/                  routes, navigation and providers
  components/           dialogs, status badges, equipment icons
  data/                 types, sample data, validation, operations, repositories
  features/
    auth/               optional cloud sign-in
    jobs/               board/list, intake, repair and estimate detail
    estimates/          quote register
    parts/              stock catalogue and receiving
    customers/          contact and service history
    reports/            workload and payment summaries
    settings/           technicians, backup and restore
  lib/                  dates, currency, downloads, safe CSV
supabase/schema.sql     separate cloud schema and staff policies
public/                 repair-shop branding and PWA icons
```

## Deployment

`npm run build` produces static output in `dist`. `.openai/hosting.json` binds this app to its own private Site. For another static host, serve `dist` and rewrite unknown navigation routes to `index.html`; a portable Vercel configuration is included. Use HTTPS for PWA installation. The service worker caches only the app shell/assets, not cloud API data or authentication responses. The generated app icons are independent repair-shop artwork derived from `public/icon.svg`.

## Validation

`npm test` covers the full repair lifecycle, stock atomicity, duplicate part lines, payment limits, closed-job protection, backup validation, stale writes, damaged-storage recovery, CSV formula escaping and SQL staff/RLS permissions. Browser QA covers intake, quote approval, stock deduction, quality-check gating, payment/collection, stock receipts and mobile layout.

## Scope

This release is an internal workshop tool. It does not include a public customer portal, automated SMS/email, accounting integration, online payments, tax calculation or supplier purchasing. Keep historical approved repairs intact; additional work should get a new request. Inventory prices are selling prices; stock value and reports are not profit calculations. The current interface does not reverse approved work or recorded payments; verify entries before recording them.
