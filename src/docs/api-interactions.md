# API interaction map

This document walks through where and how the front-end talks to the BRIN backend (the Base44 platform) so you can quickly understand the request/response patterns organized by folder.

## 1. API client foundation
- The SDK client at [src/api/base44Client.js](src/api/base44Client.js#L1-L13) instantiates `base44` with `appId`, `token`, and `functionsVersion` from `appParams`, leaves `serverUrl` empty (so the SDK targets the Base44 default), and opts out of built-in authentication because tokens are handled manually.
- Every Base44 call attaches the configured `Authorization: Bearer <token>` when a token exists. Responses are JSON objects/arrays that represent the requested entity (e.g., `[{ id, name, status, ... }]` for list endpoints or `{ id, ... }` for create/update).

### 1.1 Base44 SDK HTTP conventions
- `createClient` ([node_modules/@base44/sdk/dist/client.js](node_modules/@base44/sdk/dist/client.js#L1-L140)) builds axios instances whose `baseURL` is `https://base44.app/api` (or whatever `serverUrl` you pass). It injects `X-App-Id` on every request and adds `Base44-Functions-Version` when functions endpoints are used.
- Each axios instance comes from `createAxiosClient` ([node_modules/@base44/sdk/dist/utils/axios-client.js](node_modules/@base44/sdk/dist/utils/axios-client.js#L1-L120)). The function sets `Content-Type: application/json`, `Accept: application/json`, adds `Authorization: Bearer <token>` when a token exists, and automatically stamps `X-Origin-URL` for iframe-aware telemetry before dispatching the request. Responses return `response.data` while errors are normalized to `Base44Error`.

### 1.2 Entities module endpoints
- The entities handler ([node_modules/@base44/sdk/dist/modules/entities.js](node_modules/@base44/sdk/dist/modules/entities.js#L1-L68)) resolves to `/apps/{appId}/entities/{Entity}` and exposes the methods below. Headers/body use the axios defaults described above.

| Method | HTTP verb + endpoint | Payload / query | Description |
| --- | --- | --- | --- |
| `list()` | `GET /apps/{appId}/entities/{Entity}` | Query params: `sort`, `limit`, `skip`, `fields` | Returns an array of records for the entity. |
| `filter(query)` | `GET /apps/{appId}/entities/{Entity}?q=JSON.stringify(query)` | Query param `q` (JSON filter) plus `sort/limit/skip/fields` | Runs a server-side filter with paging. |
| `get(id)` | `GET /apps/{appId}/entities/{Entity}/{id}` | n/a | Fetches a single record. |
| `create(data)` | `POST /apps/{appId}/entities/{Entity}` | JSON payload | Inserts a new record; returns the created object. |
| `update(id, data)` | `PUT /apps/{appId}/entities/{Entity}/{id}` | JSON payload (partial/full) | Replaces or patches the entity. |
| `delete(id)` | `DELETE /apps/{appId}/entities/{Entity}/{id}` | n/a | Deletes a single record. |
| `deleteMany(query)` | `DELETE /apps/{appId}/entities/{Entity}` | JSON filter body | Batch deletes matching entities. |
| `bulkCreate(data)` | `POST /apps/{appId}/entities/{Entity}/bulk` | Array of records | Creates multiple entries in a single call. |
| `importEntities(file)` | `POST /apps/{appId}/entities/{Entity}/import` | `multipart/form-data` file upload | Uploads records from an import file. |

### 1.3 App logs & integrations endpoints
- `appLogs.logUserInApp(pageName)` hits `POST /app-logs/{appId}/log-user-in-app/{pageName}` (node_modules/@base44/sdk/dist/modules/app-logs.js#L1-L18); it streams the navigation event without a body. The Base44 axios client adds `Authorization` and the other default headers.
- `integrations.Core.SendEmail(payload)` calls `POST /apps/{appId}/integration-endpoints/Core/SendEmail` (node_modules/@base44/sdk/dist/modules/integrations.js#L1-L49). The payload is JSON `{ to, subject, body }` unless a `File` is included, in which case the SDK switches to `multipart/form-data` wordings for the request.

### 1.4 Auth module endpoints
- `base44.auth.me()` requests `GET /apps/{appId}/entities/User/me` to load the current user profile (node_modules/@base44/sdk/dist/modules/auth.js#L1-L20). `updateMe` mirrors that path via `PUT` with the updated fields.
- `logout()` clears `Authorization`, removes tokens from `localStorage`, and optionally redirects/reloads the page. `redirectToLogin(nextUrl)` builds `${serverUrl ?? ''}/login?from_url={nextUrl}` (node_modules/@base44/sdk/dist/modules/auth.js#L20-L50).
- Other auth helpers (login, register, verify-OTP, password reset/change) hit `/apps/{appId}/auth/*` (node_modules/@base44/sdk/dist/modules/auth.js#L50-L140) with JSON bodies such as `{ email, password }` or `{ reset_token, new_password }` when those operations are invoked.

## 2. lib (shared orchestrators)
### Authentication + public app settings
- [src/lib/AuthContext.jsx](src/lib/AuthContext.jsx#L1-L154) first makes a `GET` request to `/api/apps/public/prod/public-settings/by-id/{appId}`, sending `X-App-Id: {appId}` plus `Authorization: Bearer <token>` when a token exists and no request body, so the server can decide if auth is required or if the user is registered. The response is stored in `appPublicSettings` and exposes keys such as `{ id, public_settings }`.
- If a token exists, `AuthContext` immediately calls `base44.auth.me()` to fetch the current user (`{ id, full_name, email, role, app_id, ... }`). Failures with 401/403 set an `auth_required` error so the UI either prompts for login or shows the registration error.
- Logout and login redirects use `base44.auth.logout(...)` and `base44.auth.redirectToLogin(...)`, which clean up tokens in the SDK and trigger the Base44-hosted auth flows.

### Navigation tracking
- [src/lib/NavigationTracker.jsx](src/lib/NavigationTracker.jsx#L1-L50) watches `react-router` changes and, when a user is authenticated, calls `base44.appLogs.logUserInApp(pageName)` to POST a log entry for the current page. The backend returns a simple acknowledgement, and failures are silenced so the UI never breaks.
- [src/lib/NavigationTracker.jsx](src/lib/NavigationTracker.jsx#L1-L50) watches `react-router` changes and, when a user is authenticated, calls `base44.appLogs.logUserInApp(pageName)` to `POST /app-logs/{appId}/log-user-in-app/{pageName}` (see Section 1.3) so the backend can record which page the user visited. The backend returns a simple acknowledgement, and failures are silenced so the UI never breaks.

## 3. components/utils (shared helpers)
- [src/components/utils/emailTemplateHelper.jsx](src/components/utils/emailTemplateHelper.jsx#L1-L193) coordinates several backend flows:
  - `base44.entities.EmailTemplate.list()` fetches every template so that helpers can pick the one whose `object_type`, `status_to`, and `recipient_role` match the current workflow. Response: an array of templates with `email_subject`, `email_body`, and flag fields like `is_active`.
  - `base44.entities.NotificationSetting.list()` retrieves notification preferences (email addresses, enabled toggles, etc.) so the helper can decide who should receive each notification. It also logs audit rows as needed.
  - `base44.integrations.Core.SendEmail(...)` sends templated emails to the selected recipients. Each request includes `to`, `subject`, and `body`; success is just a Base44 acknowledgement, while failures are logged per recipient.
  - `base44.entities.Notification.create(...)` and `base44.entities.AuditLog.create(...)` persist platform notifications/audit trails for status changes. Responses return the created record with `id` and the same payload fields.

## 4. Layout & header UX
- [src/Layout.jsx](src/Layout.jsx#L1-L273) imports the `base44` client (dynamically on demand) and immediately calls `base44.entities.Notification.list()` when a demo user is present to populate the bell icon.
  - The request returns an array of notification objects (`{ id, title, message, is_read, module, target_role, ... }`); the component counts how many have `is_read: false` and shows that number on the badge. Errors reset the count to zero but don’t block rendering.

## 5. src/pages (primary domain CRUD calls)
Every page under `src/pages` calls `base44.entities.<Entity>.<method>` to drive its data table, form, or filter state. The table below summarizes the most-used entity APIs and the way their requests/responses are used in the UI.

| Domain entity | Methods invoked | UI flows / purpose | Expected response payload |
| --- | --- | --- | --- |
| `Debtor` | `list`, `filter`, `update`, `bulkCreate`, `delete` | Dashboards (AdvancedReports, BatchProcessing, BorderoManagement, DebtorReview, SubmitDebtor) use `list`/`filter` to populate tables and drills; forms update or bulk-create debtor records | Objects with `{ id, name, debtor_id, status, contract_id, batch_id, ... }` |
| `Batch` | `list`, `filter`, `update`, `create`, `delete` | BatchProcessing and DebtorReview load batch lists/notes and submit status updates or batch creations | `{ id, batch_id, debtor_count, contract_id, status, ... }` |
| `Claim` | `list`, `filter`, `update`, `create`, `delete` | ClaimSubmit, ClaimReview, AdvancedReports, SystemConfiguration manage claim lifecycles | `{ id, claim_id, debtor_id, nota_id, status, message, ... }` |
| `Nota` | `list`, `filter`, `create`, `update`, `delete` | NotaManagement and Claim flows rely on nota lists / detail updates for payment reconciliation | `{ id, nota_id, amount, status, batch_id, debtor_id, ... }` |
| `PaymentIntent` | `list`, `create`, `update`, `delete` | PaymentIntent page and NotaManagement trigger payment workflows and handle intent adjustments | `{ id, payment_intent_id, amount, status, nota_id, ... }` |
| `MasterContract`, `Contract`, `Bordero`, `Document`, `Invoice`, `Payment`, `DebitCreditNote`, `SystemConfig`, `Record`, `Subrogation`, `Notification`, `NotificationSetting`, `EmailTemplate`, `SlaRule`, `AuditLog` | `list`, plus occasional `filter`/`create`/`update`/`delete` | Used by SystemConfiguration (CRUD dashboards) and other pages to keep reference data in sync | Entity-specific JSON records with IDs, metadata, and status flags |
| `Notification` (from pages) | `update`, `delete` | NotificationCenter toggles `is_read` and deletes | Returns updated notification object |

Every list request returns an array of the requested entity, while creates/updates return the new/updated record so the UI can refresh state immediately.

## Summary
- `src/api` exposes a single Base44 client that all folders share.
- `src/lib` orchestrates authentication checks and navigation logging.
- `components/utils` handles reusable notification/email workflows that call `EmailTemplate`, `NotificationSetting`, `Notification`, `AuditLog`, and integration APIs.
- `src/Layout.jsx` and all `src/pages/*` consume those helpers plus direct entity APIs to load lists, filter data, create or mutate records, and keep notification badges / audit trails updated.

Feel free to add follow-up sections in this file if you discover new entity APIs or extend existing flows.