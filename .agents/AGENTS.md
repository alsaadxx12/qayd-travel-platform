# Project Rules

## 1. Core Principles

* Inspect and understand the existing implementation before making changes.
* Identify the root cause of a problem before implementing a fix.
* Preserve the current project architecture, naming conventions, and design system.
* Produce complete, production-ready code without placeholders, incomplete sections, or unresolved `TODO` comments.
* Do not remove or rewrite existing functionality unless it is necessary for the requested change.
* Preserve unrelated user changes and avoid modifying files outside the task scope.

---

## 2. Architecture (Do Not Confuse Hosting With The App API)

This is a **NestJS + Prisma + React** accounting system. PostgreSQL is **hosted on Supabase**. That does **not** mean the frontend should talk to Supabase.

Use **both**, each for its real job. This is **not** a choice of backend *or* Supabase:

| Layer | Role |
|---|---|
| PostgreSQL on Supabase | Stores business tables. Source of truth for records. |
| NestJS + Prisma | The only application API for business data, auth, accounting rules, and authorization. |
| Supabase Storage | File/image uploads from the **backend** only (logos, receipts). |
| React + TanStack Query | UI. Calls NestJS REST (`/api` via `frontend/src/api/client.ts`). Never calls Supabase for CRUD. |

Required data flow:

`PostgreSQL (Supabase-hosted) → Prisma inside NestJS → REST /api → React Query → UI`

### Do not

* Use `@supabase/supabase-js`, PostgREST, Supabase RPC, or the anon key from the frontend for business data.
* Bypass NestJS and read/write tables from the browser “for speed”.
* Treat this as a Supabase Auth + RLS app. Login is NestJS JWT. Authorization lives in NestJS guards/services (`companyId`, tenant, permissions).
* Invent or “inspect” Supabase RLS policies as if they were the app’s security model. They are not how this codebase authorizes users.
* Expose `service_role`, `DATABASE_URL`, or other server secrets in frontend code.

Supabase Management API may be used **only on the backend** for operational/SaaS metrics already implemented there.

---

## 3. Real Database Data Only

All business data displayed or modified by the application must come from the real PostgreSQL database through NestJS. Hosting that database on Supabase does not change this rule.

### Prohibited

* Mock, fake, dummy, sample, or demo business data.
* Hardcoded customers, companies, suppliers, accounts, transactions, tickets, balances, statistics, or financial figures.
* Fake fallback arrays when an API or database request fails.
* Randomly generated business records.
* Using `localStorage` as the primary storage for business entities.
* Calculating official financial balances from hardcoded frontend values.
* Guessing database table names, column names, relationships, or IDs.
* Silently replacing missing database data with fabricated values.

`localStorage` may only be used for non-sensitive UI preferences such as theme, sidebar state, table layout, or language.

---

## 4. Required Data Flow Details

* Business rules and sensitive database operations must not be implemented only inside React components.
* Business data must pass through existing NestJS modules, services, DTOs, and `/api` endpoints.
* Use TanStack Query for server-state fetching, caching, loading, error handling, and cache invalidation.
* After successful mutations, invalidate or update the relevant queries.
* Use server-side pagination, filtering, sorting, and aggregation for large datasets.
* Dashboard statistics must be calculated in NestJS from real Prisma queries, SQL, views, or existing aggregation endpoints — not from hardcoded frontend numbers and not from Supabase RPC invented for this project.

---

## 4.1 Performance SLO — Pages And Lists Must Feel Instant (≤ 2 seconds)

Target: first meaningful data on list/dashboard screens in **2 seconds or less** after the request starts (local NestJS on port 4000, Vite proxy `/api` → `localhost:4000`). Do **not** “speed up” by calling Supabase from the browser.

### Known causes of delay in this codebase (fix these; do not invent a second data path)

1. **Wrong API host in local dev.** `frontend/src/api/client.ts` must use same-origin `/api` in `import.meta.env.DEV` so Vite proxies to NestJS. Sending the SPA to Render while developing adds cold-start delays of tens of seconds.
2. **Unpaged `findMany`.** Tickets, visas, journal entries, and vouchers must not dump the entire table. Default list `take` 150 (max 300) plus date/branch filters on the server. The UI paginates; the API must too.
3. **Fat list payloads.** Never send `transferImage`, airline `logo`, or other Base64 blobs on list endpoints. Load them on the detail/editor request only.
4. **Loading all journal lines to paint a dropdown.** Account pickers use `GET /accounts?lite=1` (names/ids only). Full balances belong on `/accounts/tree` or account profile.
5. **Dashboard aggregating every ticket in the browser.** Use `/tickets/dashboard-summary`. On summary failure, show an error/retry — do not fall back to `GET /tickets`.
6. **Refetch storms.** TanStack Query: `staleTime` ~30s, `retry: 0` for reads, no refetch on window focus. Deduplicate in-flight GETs (already in `apiRequest`).
7. **Render/free-tier cold start** in production can exceed 2s on the first hit. That is hosting, not a reason to bypass NestJS.

When adding a list page: server-side `limit` + filters, slim `select`, skeleton in under 2s, then fill. Detail endpoints may take longer.

---

## 5. Mandatory Database Inspection

Before building or modifying any data-dependent page:

1. Inspect `backend/prisma/schema.prisma` for exact models, fields, enums, and relations.
2. Verify primary keys and foreign keys in that schema.
3. Inspect constraints, indexes, and any SQL under `backend/prisma/` or related scripts.
4. Inspect the existing NestJS services, DTOs, controllers, and frontend API modules/hooks.
5. Confirm how the feature is currently connected: UI → `frontend/src/api/*` → NestJS → Prisma → PostgreSQL.

Do not write database-dependent code until this inspection is complete. Do not guess table names.

---

## 6. Database and Schema Safety

* Use real primary keys and foreign keys for all relationships.
* Reuse existing tables, columns, views, functions, and relationships whenever they already serve the required purpose.
* Do not create a new table merely to avoid understanding the existing schema.
* If a schema change is genuinely required, explain the reason before implementing it.
* Apply schema changes through Prisma (`schema.prisma`). Prefer versioned Prisma migrations when introducing them; do not silently `db push` or run ad-hoc production DDL without explicit approval.
* Never manually change production database structure outside the agreed schema process.
* Do not delete tables, columns, migrations, functions, or real records without explicit approval.
* Do not modify `.env` files, credentials, API keys, or secrets unless explicitly requested.
* Never print, expose, commit, or include secret values in logs or responses.
* Enforce authorization in NestJS (guards, tenant/company/branch scoping). Do not assume RLS will protect queries.
* Use database transactions for operations that update multiple related financial records.
* Never update account balances directly when they should be derived from journal entries or financial transactions.
* Do not silently delete or rewrite posted accounting records.

---

## 7. CRUD Requirements

All create, read, update, and delete operations must use the real database through NestJS.

Every CRUD workflow must include:

* Input validation.
* Authentication and authorization checks.
* Proper foreign-key handling.
* Loading state.
* Success feedback.
* Clear error feedback.
* Cache invalidation or refresh after mutations.
* Protection against duplicate submissions.
* Proper handling of database constraint errors.
* An empty state when no records exist.

Do not show fake data when a request fails. Display a clear error state with an appropriate retry action.

---

## 8. Dropdowns and Selection Fields

* Dropdowns representing business entities must load their options from the real database via NestJS APIs.
* This includes customers, companies, suppliers, accounts, branches, employees, currencies, cashboxes, and other business records.
* **CRITICAL RULE - Real Payment Methods**: Payment method options must be loaded from real system settings / database configurations (`system-settings-payment-methods` / `payment_methods_mapping`) with fallback to standard business payment methods.
* **CRITICAL RULE - Payment Receipt Attachments**: Any invoice or voucher editor must provide a file attachment interface for payment receipts and vouchers with upload and preview capability.
* Do not hardcode database entity IDs.
* Store the real record ID as the selected value.
* **CRITICAL RULE**: NEVER display, concatenate, or append account numbers/codes (e.g. `(1343101)` or `(1341201)`) with account names in dropdown labels, comboboxes, selection fields, or UI labels. Always display exclusively the clean human-readable account name (e.g. `ماستر 1 الوكيل` or `صندوق احمد`) without appending `(code)`.
* Static UI-only options may be defined as shared typed constants when they are not database entities.

---

## 9. TypeScript and Code Quality

* Keep TypeScript strict.
* Avoid `any`. Use explicit types, interfaces, generics, or `unknown` with proper narrowing.
* Reuse existing types and schemas whenever possible.
* Keep API contracts synchronized between frontend and backend.
* Use Zod, DTO validation, or the project’s existing validation approach.
* Do not duplicate business logic across components.
* Extract reusable components, hooks, services, schemas, and utilities when appropriate.
* Keep React components focused and reasonably sized.
* Follow the existing folder structure and naming conventions.
* Do not introduce a new library if the project already contains a suitable solution.
* Do not perform unrelated large refactors during a focused task.
* Handle asynchronous errors explicitly; do not swallow exceptions.

---

## 10. UI and UX Requirements

* Maintain complete Arabic RTL and English LTR bilingual support (`isAr ? ... : ...`, `t(...)`, `dir={direction}`).
* **CRITICAL RULE - Strictly English Numerals**: ALL numbers, monetary amounts, rates, prices, ticket fares, totals, balances, dates, sequence codes, quantities, table cells, and numerical inputs across the entire application MUST ALWAYS be formatted exclusively with English Western numerals (`0123456789`, `font-mono tabular-nums lining-nums`, `en-US` formatting). NEVER display Eastern Arabic numerals (`٠١٢٣٤٥٦٧٨٩`).
* **CRITICAL RULE - Monetary and Numerical Typography**: All monetary figures, balances, rates, prices, ticket fares, totals, and numerical inputs across the entire application must be explicitly styled with bold, crisp, thick typography (`font-weight: 800` or `font-weight: 700`, `tabular-nums lining-nums`, and clean monospace/numbers font like `JetBrains Mono` / `Consolas`). Never display monetary values or numerical inputs in thin, light, or illegible fonts.
* **CRITICAL RULE - Brand White & Orange Color Palette (Prohibition of Dark / Slate-900 Blocks)**: Do NOT use dark black, slate-900, or heavy dark gray blocks for container backgrounds, headers, or financial summary cards. Exclusively use the system design system: Pure White (`bg-white`), Crisp Light Borders (`border-slate-200` / `border-[#E5E7EB]`), Signature Brand Orange (`#F45A0A` / `#DD4F05`), and Soft Brand Accents (`bg-[#FFF3E8]` / `bg-orange-50`).
* **CRITICAL RULE - Modern Custom Styled Dropdowns**: Dropdowns, select fields, and entity choosers must always be modern styled custom comboboxes (`SearchableCombobox` with search, clear labels, clean chevrons, and standardized `48px` / `38px` heights). Avoid raw, unstyled browser `<select>` elements.
* Preserve the existing design system, spacing, typography, colors, and component patterns.
* Use existing shared components before creating new ones.
* Do not redesign unrelated sections of a page.
* Every data-dependent interface must provide:
  * Loading or skeleton state.
  * Empty state.
  * Error state.
  * Success feedback when appropriate.
* Tables must support real data and must not depend on hardcoded rows.
* Forms must display clear Arabic validation messages.
* Prevent layout overlap, clipped text, and broken RTL alignment.
* Maintain responsive behavior across supported screen sizes.

---

## 11. Verification Requirements

After completing each logical **code** change:

1. Identify the package manager and available scripts.
2. Run the available TypeScript type-check command.
3. Run ESLint or the configured linter.
4. Run relevant automated tests.
5. Run the production build.
6. Run relevant database or integration checks when available.
7. Review the final diff for accidental or unrelated changes.

If a command fails:

* Investigate the actual cause.
* Fix errors caused by the current task.
* Run the command again.
* Do not claim that the task is complete while relevant checks are failing.

If a required script does not exist, report that clearly instead of inventing a successful result.

Documentation-only or agent-rules-only edits do not require a frontend/backend production build.

---

## 12. Destructive and High-Risk Actions

The following actions require explicit approval:

* Deleting real data.
* Dropping or renaming database objects.
* Rewriting migration history.
* Changing authentication or authorization behavior.
* Changing database roles or enabling/disabling RLS as a substitute for NestJS auth.
* Routing the frontend directly to Supabase for business data.
* Modifying secrets or environment configuration.
* Running destructive Git commands.
* Force-pushing or overwriting remote branches.
* Making broad architectural changes outside the requested scope.

Prefer reversible and minimal changes.

---

## 13. Completion Requirements

A task is complete only when:

* The requested functionality is fully implemented.
* The implementation uses real PostgreSQL data through NestJS/Prisma.
* No mock or fallback business data remains.
* Loading, empty, error, and success states are handled.
* Relevant validation and permissions are enforced in NestJS.
* Type checking, linting, tests, and production build have been run when the change includes application code.
* Relevant failures have been fixed or clearly reported.

At the end of every task, provide:

1. A concise summary of what was implemented.
2. A list of modified files.
3. Any database or migration changes.
4. Verification commands that were actually executed.
5. The real result of each verification command.
6. Any remaining limitations, risks, or required manual steps.
