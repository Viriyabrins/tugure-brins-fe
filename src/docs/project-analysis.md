# BRIN Frontend (Base44) Analysis

## Technology stack
- **Framework**: Vite 6 with React 18 (`@vitejs/plugin-react`, `typescript`/`jsconfig` for `react-jsx`, esnext modules, and `@` path alias to `src`).
- **Styling**: Tailwind CSS 3.4 with `tailwind-merge`, `tailwindcss-animate`, `autoprefixer`, `postcss`, a handful of global CSS files (`globals.css`, `index.css`) plus utility wrappers that combine `clsx` and `twMerge`.
- **UI primitives**: Radix UI components (accordion, dialog, etc.) backed by custom wrappers in `src/components/ui`, Lucide icons, Framer Motion, `react-resizable-panels`, `cmdk`, `react-day-picker`, `react-leaflet`, `react-quill`, `recharts`, `react-markdown`, `three`, `embla-carousel`, `canvas-confetti`, `jspdf`, `html2canvas` and `moment/date-fns` for rich interactions, charts, maps, documents, and animation.
- **State and forms**: React Router v6, React Query 5, React Hook Form + Zod + `@hookform/resolvers`, `@tanstack/react-query` for caching, `react-hot-toast` for toast feedback, `next-themes` for theme switching, `react-stripe-js` + Stripe JS, `vaul` for WebAuthN and session management.
- **Utilities**: `lodash`, `clsx`, `class-variance-authority`, `tailwind-merge`, `html2canvas`, `jspdf`, and `input-otp` for UI helpers and sanitization.

## Composition & routing
- `src/main.jsx` bootstraps React by rendering `<App />` into `#root`.
- `App.jsx` layers the application inside `AuthProvider`, `QueryClientProvider`, and `BrowserRouter`, injects `NavigationTracker`, global `Toaster`, and `VisualEditAgent` (iframe-aware UI editor). `pagesConfig` supplies `Pages`, a `Layout`, and a `mainPage` that drives routing.
- `pages.config.js` Centralizes every page component (Dashboard, Home, MasterContractManagement, etc.), defines `mainPage` (`Dashboard`), and wires the shared `Layout`. Routes are created dynamically based on this map, so adding a page is a matter of updating `pages.config` plus the new component.
- `Layout.jsx` renders the branded BRINS/TUGURE frame: sticky header, collapsible sidebar (common, operations, shared sections), role-based guards, notification badge (calls `base44.entities.Notification.list()`), and a logout handler that clears the demo user. It only renders for non-Home pages so the landing/login page can own its copy.
- Shared components under `src/components` include `ProtectedRoute`, `UserNotRegisteredError`, dashboard-specific cards/buttons, and an extensive `components/ui` folder of Radix/Tailwind primitives (button, card, dropdown, etc.).

## Base44 SDK & App Support
- `src/lib/app-params.js` reads `app_id`, `access_token`, `functions_version`, and related params from the URL, local storage, or build-time env vars, keeping query values in storage and supporting the `clear_access_token` workflow.
- `src/api/base44Client.js` creates a Base44 client with the params above and exposes it for reuse; `requiresAuth` is currently disabled so the SDK can be reused for public settings.
- `AuthContext.jsx` queries the Base44 `public-settings` endpoint (`/api/apps/public/prod/public-settings/by-id/:appId`) to determine if auth is required, then calls `base44.auth.me()`, exposes `logout`/`redirectToLogin`, and surfaces loading/auth state up the tree. Authentication failures map to typed errors (not registered, auth required).
- `NavigationTracker.jsx` posts navigation events up to `window.parent` for telemetry and calls `base44.appLogs.logUserInApp(pageName)` whenever an authenticated user enters a page.
- `VisualEditAgent.jsx` implements the Base44 visual editing overlay inside an iframe: it listens to parent window commands (`toggle-visual-edit-mode`, `update-classes`, etc.), renders hover/selection overlays, merges Tailwind class names, and reports layout/selection info back for the visual editing duel.
- `PageNotFound.jsx` keeps trying to call `base44.auth.me()` (via `useQuery`) so admins can receive guidance about missing pages instead of a silent 404.

## Supporting SDKs & integration spots
- `@base44/vite-plugin` enables legacy SDK imports and adds HMR notification support, meaning the Base44 CLI can inject tooling metadata into Vite during dev.
- `@stripe/react-stripe-js` + `@stripe/stripe-js` cover payment intent flows seen in pages like `PaymentIntent` and `PaymentStatus`.
- `vaul` and WebAuthN afford passwordless onboarding, while `react-leaflet`, `three`, `recharts`, `react-days-picker`, `react-quill`, and `embla` deliver rich client experiences (maps, 3D visuals, charts, editors, carousels).
- Form validation relies on React Hook Form → Zod → `@hookform/resolvers`, the UI uses `clsx` + `tailwind-merge` to keep Tailwind composition manageable, and toast/notification experiences rely on `react-hot-toast` + `sonner` for accessible messages.

## Docs & domain context
- The root `docs/entities/` directory contains a suite of plaintext entity summaries (AuditLog, Claim, Payment, etc.) that appear to describe Base44 or BRIN data models. Treat them as domain references for new pages or data contracts.
- `README.md` currently only records “Base44 App”, so this new `src/docs/project-analysis.md` fills out the high-level platform overview requested.

## Domain entities (src/entities)
- Each TXT file under `src/entities` encodes a JSON schema describing a Base44 entity, so the folder doubles as machine-readable documentation for the data contracts the frontend expects to surface (e.g., the fields used in `BatchProcessing`, `ClaimReview`, payments, notifications, etc.).
- Entities fall into a few operational buckets:
	- **Underwriting & billing**: `Batch`, `Contract`, `MasterContract`, `Debtor`, and `Record` track the upload → validation → approval workflow. They enforce statuses (`Draft`, `Submitted`, `Approved`), version numbers, foreign keys (`contract_id`, `batch_id`), and region/coverage metadata.
	- **Financial documents**: `Nota`, `Invoice`, `DebitCreditNote`, `Payment`, `PaymentIntent`, and `Reconciliation` encode the strict workflow statuses (`Issued`, `Paid`, `Closed`, etc.), immutable financial amounts, and references between invoices, payments, and nota adjustments.
	- **Claims & recoveries**: `Claim` and `Subrogation` contain policy/claim identifiers, status enums, recovery amounts/dates, and reviewer approvals. `Batch` and `Claim` stage metadata includes who completed each transition for auditability.
	- **Notifications & automation**: `Notification`, `NotificationSetting`, `EmailTemplate`, and `SlaRule` define alert payloads, recipient roles, and SLA-triggered templates (subjects/bodies support `{entity_id}`, `{status}`, and similar tokens).
	- **System support**: `SystemConfig`, `AuditLog`, and `Bordero` capture configuration templates, audit trails, and reporting bundles with their own state machines.
- Several schemas reuse enumerations (`status`, `module`, `entity_type`, currency defaults) so the UI stays aligned with backend workflows; extending the app typically means adding a new schema file and ensuring the corresponding page reads the same fields.

## Notes
- ESLint (`eslint.js`, React plugins) plus `@eslint/js` keep code quality enforced and TypeScript is checked via `tsc -p jsconfig.json` (even though files are `.jsx`).
- `ProtectedRoute` and other guards sit ready under `components`, meaning future pages can enforce additional per-role constraints if needed.
- Next steps: keep `pages.config` current as features grow, align any new API calls with `base44.entities`, and use the visual edit agent hooks when design updates happen in the embedded iframe.
