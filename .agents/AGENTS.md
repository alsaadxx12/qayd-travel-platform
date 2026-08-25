# Project Rules

## 1. Core Principles

* Inspect and understand the existing implementation before making changes.
* Identify the root cause of a problem before implementing a fix.
* Preserve the current project architecture, naming conventions, and design system.
* Produce complete, production-ready code without placeholders, incomplete sections, or unresolved `TODO` comments.
* Do not remove or rewrite existing functionality unless it is necessary for the requested change.
* Preserve unrelated user changes and avoid modifying files outside the task scope.

---

## 2. Supabase Is the Only Source of Business Data

All business data displayed or modified by the application must come exclusively from the real Supabase PostgreSQL database.

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

## 3. Required Data Flow

Use the following data flow:

`Supabase PostgreSQL → Backend/API or Data Service → React Query → React UI`

* Business rules and sensitive database operations must not be implemented only inside React components.
* If the project contains a NestJS backend, business data must pass through the existing backend services and API endpoints.
* Never expose the Supabase `service_role` key or any server secret in frontend code.
* Use TanStack Query for server-state fetching, caching, loading, error handling, and cache invalidation.
* After successful mutations, invalidate or update the relevant queries.
* Use server-side pagination, filtering, sorting, and aggregation for large datasets.
* Dashboard statistics must be calculated from real database queries, views, RPC functions, or backend aggregation endpoints.

---

## 4. Mandatory Database Inspection

Before building or modifying any data-dependent page:

1. Inspect the relevant database tables.
2. Verify exact table and column names.
3. Inspect primary keys and foreign keys.
4. Inspect constraints, indexes, views, and enums.
5. Inspect existing migrations and database functions.
6. Inspect applicable Supabase RLS policies.
7. Inspect the existing backend services, DTOs, API endpoints, and frontend query hooks.
8. Confirm how the feature is currently connected to the database.

Do not write database-dependent code until this inspection is complete.

---

## 5. Database and Schema Safety

* Use real primary keys and foreign keys for all relationships.
* Reuse existing tables, columns, views, functions, and relationships whenever they already serve the required purpose.
* Do not create a new table merely to avoid understanding the existing schema.
* If a schema change is genuinely required, explain the reason before implementing it.
* Apply schema changes only through versioned migrations.
* Never manually change production database structure outside the migration system.
* Do not delete tables, columns, migrations, functions, policies, or real records without explicit approval.
* Do not modify `.env` files, credentials, API keys, or secrets unless explicitly requested.
* Never print, expose, commit, or include secret values in logs or responses.
* Respect existing RLS policies and application authorization rules.
* Use database transactions for operations that update multiple related financial records.
* Never update account balances directly when they should be derived from journal entries or financial transactions.
* Do not silently delete or rewrite posted accounting records.

---

## 6. CRUD Requirements

All create, read, update, and delete operations must use the real database.

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

## 7. Dropdowns and Selection Fields

* Dropdowns representing business entities must load their options from the real database.
* This includes customers, companies, suppliers, accounts, branches, employees, currencies, cashboxes, and other business records.
* **CRITICAL RULE - Real Payment Methods**: Payment method options must be loaded from real system settings / database configurations (`system-settings-payment-methods` / `payment_methods_mapping`) with fallback to standard business payment methods.
* **CRITICAL RULE - Payment Receipt Attachments**: Any invoice or voucher editor must provide a file attachment interface for payment receipts and vouchers with upload and preview capability.
* Do not hardcode database entity IDs.
* Store the real record ID as the selected value.
* **CRITICAL RULE**: NEVER display, concatenate, or append account numbers/codes (e.g. `(1343101)` or `(1341201)`) with account names in dropdown labels, comboboxes, selection fields, or UI labels. Always display exclusively the clean human-readable account name (e.g. `ماستر 1 الوكيل` or `صندوق احمد`) without appending `(code)`.
* Static UI-only options may be defined as shared typed constants when they are not database entities.

---

## 8. TypeScript and Code Quality

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

## 9. UI and UX Requirements

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

## 10. Verification Requirements

After completing each logical change:

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

---

## 11. Destructive and High-Risk Actions

The following actions require explicit approval:

* Deleting real data.
* Dropping or renaming database objects.
* Rewriting migration history.
* Changing authentication or authorization behavior.
* Changing RLS policies.
* Modifying secrets or environment configuration.
* Running destructive Git commands.
* Force-pushing or overwriting remote branches.
* Making broad architectural changes outside the requested scope.

Prefer reversible and minimal changes.

---

## 12. Completion Requirements

A task is complete only when:

* The requested functionality is fully implemented.
* The implementation uses real Supabase data.
* No mock or fallback business data remains.
* Loading, empty, error, and success states are handled.
* Relevant validation and permissions are enforced.
* Type checking, linting, tests, and production build have been run when available.
* Relevant failures have been fixed or clearly reported.

At the end of every task, provide:

1. A concise summary of what was implemented.
2. A list of modified files.
3. Any database or migration changes.
4. Verification commands that were actually executed.
5. The real result of each verification command.
6. Any remaining limitations, risks, or required manual steps.
