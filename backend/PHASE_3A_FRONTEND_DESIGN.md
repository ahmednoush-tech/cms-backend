# Phase 3A — Frontend Foundation Design

**Status: design only.** No frontend code was written. No backend, schema, or migration file was touched — confirmed unchanged before and after this document (`schema.prisma` checksum `5fdda241d9239192bd2663ca64ab9e97`, 25 migrations, 131 backend `.ts` files, all identical to the last verified baseline).

**Methodology**: every route, permission string, DTO field, and response shape referenced below was extracted directly from the actual backend source this session via `grep`/`view` — not recalled from memory, not invented. Section I (route map) and the permission list in section D are 1:1 transcriptions of what the controllers actually declare. No existing frontend project was found anywhere in the workspace (confirmed via `find`) — this is a greenfield design, not a modification of prior work.

The backend has **not been runtime-verified** (per every prior phase report, unchanged status). Nothing in this document claims otherwise.

---

## A. Frontend Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **React 18 + Vite + TypeScript** | Matches the tooling already familiar from your other project (Arkan website) — reduces context-switching — and Vite's dev-server speed matters for a large admin app with many routes. Not a backend-driven requirement (the backend is framework-agnostic over HTTP), so this is a preference, not an inspection finding — **flagged in section P for your confirmation**, since a different framework (Vue, Next.js, Angular) would work equally well against this API. |
| TypeScript | Strict mode on | The backend's DTOs are strongly typed (class-validator); mirroring that discipline on the frontend keeps the two sides honest about what the API actually accepts/returns, per instruction L. |
| UI component strategy | **Headless components (Radix UI primitives) + Tailwind CSS**, no full component-library lock-in (not MUI/Ant/Chakra) | Section H requires white-labeling (colors, logo, theme per company) without rewriting components. A heavy pre-styled library fights that; headless primitives + Tailwind design tokens make theming a config change, not a component rewrite. |
| State management | **Server state**: TanStack Query (React Query) for all API data (caching, refetch, pagination). **Client/UI state**: React Context + `useReducer` for auth/session and small global UI state (sidebar collapsed, active language). **No Redux** — the app's actual state is overwhelmingly "data fetched from the API," which React Query already models correctly; a second global store would duplicate that. |
| API client | **Centralized `axios` instance** wrapped by a single `apiClient` module (see section J) — no component ever imports `axios`/`fetch` directly. |
| Form validation | **React Hook Form + Zod**, with Zod schemas mirroring the backend's `class-validator` rules field-for-field (see section L) — not because the frontend is authoritative (it isn't, per section N), but so the user gets instant feedback before a round-trip, and so client-side and server-side rules can't silently drift without someone noticing the duplication. |
| Routing | **React Router v6** (data routers / loaders pattern), matching the nested-resource shape the backend already uses (e.g. `/customers/:id/contacts` mirrors `GET /api/v1/customers/:customerId/contacts`). |
| i18n | **react-i18next**, namespaced JSON translation files per feature area, not one giant file (see section G). |
| RTL/LTR | Tailwind's built-in `rtl:`/`ltr:` variants + a single `dir` attribute toggle on `<html>`, driven by the active language — no per-component RTL logic. |
| Authentication state | A dedicated `AuthContext` holding exactly the fields the backend's `/auth/me` actually returns (`AuthContext` interface, transcribed verbatim in section L) — nothing invented, nothing extra. |
| Error handling | A single Axios response interceptor maps every backend error shape (`{ data: null, meta: null, errors: [{ code, message }] }`, confirmed this session against `http-exception.filter.ts`) into a normalized frontend error object, consumed uniformly by React Query's error states — no component parses a raw HTTP error itself. |

---

## B. Frontend Architecture

```
src/
  api/                    # section J — the ONLY layer that calls axios
    client.ts             # axios instance, interceptors, base URL
    endpoints/             # one file per backend module, typed request/response
      auth.ts
      customers.ts
      customerContacts.ts
      customerUsers.ts
      leads.ts
      opportunities.ts
      quotations.ts
      quotationItems.ts
      projects.ts
      projectMembers.ts
      workOrders.ts
      tasks.ts
      departments.ts
      employees.ts
      users.ts
      roles.ts
      permissions.ts
      dashboard.ts
    queries/               # React Query hooks built on top of endpoints/
      useCustomers.ts, useCustomer.ts, useCreateCustomer.ts, ... (one set per resource)

  auth/                   # section C
    AuthContext.tsx
    AuthProvider.tsx
    useAuth.ts
    ProtectedRoute.tsx
    tokenStorage.ts

  rbac/                   # section D — kept separate from auth/ since it's a distinct concern
    PermissionGate.tsx
    usePermissions.ts
    permissionConstants.ts   # the 43 strings from section D.1, typed as a union, not free strings

  components/             # section K — generic, reusable, no business logic
    DataTable/
    Pagination/
    SearchBar/
    FilterBar/
    Modal/
    Drawer/
    Form/
    ConfirmDialog/
    StatusBadge/
    PriorityBadge/
    EmptyState/
    LoadingState/
    ErrorState/
    PageHeader/

  layouts/                # section F
    AppLayout.tsx          # sidebar + topbar + content, for authenticated pages
    AuthLayout.tsx          # centered card, for login
    Sidebar.tsx
    Topbar.tsx
    Breadcrumbs.tsx
    UserMenu.tsx
    NotificationsMenu.tsx
    MobileNav.tsx

  pages/                  # route-level components, one per route in section I
    auth/
    dashboard/
    administration/
    crm/
    operations/

  routes/                 # section I — the route table itself, data-router config
    index.tsx
    routeMap.ts             # single source of truth, referenced by Sidebar for menu generation too

  features/               # cross-cutting business logic that isn't generic (unlike components/)
    lead-conversion/        # the multi-step convert-a-lead flow, e.g.
    quotation-builder/       # line-item editor with live Decimal-safe totals mirroring QuotationCalculator

  hooks/                  # generic reusable hooks not tied to one feature
    useDebounce.ts, useLocalStorage.ts, useMediaQuery.ts, ...

  i18n/                   # section G
    en/
    ar/
    index.ts
    statusLabels.ts          # the enum-to-label strategy, see G

  types/                  # section L — mirrors backend DTOs, generated/hand-kept in sync
    entities/               # Customer, Lead, Opportunity, Quotation, Project, WorkOrder, Task, ...
    api.ts                   # ApiResponse<T>, ApiError, PaginationMeta — matches the backend envelope exactly
    permissions.ts

  config/                 # section H — white-label configuration layer
    branding.ts
    theme.ts

  utils/
    formatDate.ts, formatCurrency.ts, formatDecimal.ts (Decimal-safe display, mirrors backend's toFixed(2) convention), ...
```

This is a variant of the structure you proposed, adjusted in two ways worth flagging explicitly:
1. **`rbac/` split out from `auth/`** — authentication (who are you) and authorization (what can you do) are handled by genuinely different backend mechanisms (`JwtAuthGuard` vs `PermissionsGuard`), so keeping them as separate frontend concerns mirrors that separation rather than blurring it.
2. **`api/queries/` added** as a sub-layer of `api/`, not a top-level folder — React Query hooks are still "how the frontend talks to the API," just the caching-aware layer on top of the raw endpoint functions. Kept together rather than split into a `hooks/` folder that would mix generic utility hooks with data-fetching hooks.

---

## C. Authentication Architecture

Transcribed directly from `AuthService`/`JwtStrategy`/`RefreshJwtStrategy`/`TokenDenylistService`, inspected this session — **not a separate protocol invented for the frontend.**

### Login flow
1. `POST /api/v1/auth/login` with `{ email, password }`.
2. Response (confirmed shape, `TokenPairDto` + embedded user object): `{ accessToken, refreshToken, expiresIn, user: { id, email, companyId, employeeId?, roles, isCustomerUser, customerId? } }`, wrapped in the standard envelope so the actual field path is `response.data.data.accessToken` etc.
3. Frontend stores `accessToken` + `refreshToken` (storage strategy below) and populates `AuthContext` from the returned `user` object.
4. Redirect to `/dashboard` (or the route the user was originally trying to reach, if arriving via a protected-route redirect).

### Access token handling
- Sent as `Authorization: Bearer <accessToken>` on every request via the Axios instance's request interceptor (section J) — no page/component sets this header itself.
- Default TTL is `15m` (confirmed via `JWT_ACCESS_TTL` default in `.env.example`) — the frontend does not hardcode this number anywhere; it reads `expiresIn` from the login/refresh response and schedules proactively (see "token expiration behavior" below).

### Refresh token handling
- `POST /api/v1/auth/refresh` with `{ refreshToken }` — confirmed this is genuinely a rotating refresh (the backend denylists the *old* `jti` on every refresh; presenting a used refresh token now correctly fails with 401, re-confirmed this session in `auth.service.ts`).
- The frontend must therefore **always store the newest refresh token returned by the last refresh call**, discarding the previous one — never retry with a stale refresh token.
- A single in-flight refresh guard is required: if multiple API calls 401 simultaneously (e.g. several widgets loading in parallel on Dashboard), only one refresh request should fire; the others queue and retry once it resolves. This is an Axios-interceptor-level concern (section J), not something individual pages implement.

### Logout
- `POST /api/v1/auth/logout` with `{ refreshToken }` — revokes it server-side (confirmed maps to `TokenDenylistService.revoke`).
- Frontend then clears both tokens from storage and clears `AuthContext`, regardless of whether the logout call itself succeeds (a network failure during logout must never leave the user "stuck" logged in on their own device).

### 401 handling
- A 401 on any request **other than** the login/refresh calls themselves triggers: attempt one silent refresh → if that also 401s, clear session and redirect to `/login`, preserving the originally-requested URL for post-login redirect.
- A 401 on the login call itself is just "wrong credentials" — shown inline on the form, no redirect.

### Session restoration
- On app load, if a refresh token exists in storage, call `POST /auth/refresh` immediately (do not trust a possibly-expired stored access token) to obtain a fresh access token and rebuild `AuthContext`, then call `GET /auth/me` to confirm the session is still valid server-side (catches the case where the account was locked/deactivated since the token was issued — `JwtStrategy` re-checks this server-side on every request, confirmed this session, so the frontend should not assume a token's mere presence means the session is still good).
- If no refresh token exists, render the app in a logged-out state immediately — no flash of protected content.

### Protected routes
- A `<ProtectedRoute>` wrapper (or React Router v6.4+ loader-based equivalent) checks `AuthContext` before rendering; unauthenticated → redirect to `/login`.
- **Customer-portal identities are blocked from every route in this V1 frontend** — the backend has no customer-portal-facing endpoints at all (confirmed: `@InternalOnly()` on every implemented controller except `auth`), so `isCustomerUser: true` in `AuthContext` should route to a distinct "portal not yet available" page, not attempt to render the internal admin UI at all.

### Unauthorized page
- A dedicated `/403` route for **backend-confirmed** authorization failures (a real 403 response from the API — not a frontend guess), distinct from the RBAC-based *hiding* of UI elements described in section D. If a user reaches a page whose primary data-fetch 403s, show this page rather than a broken/empty page.

### Token expiration behavior
- Proactive refresh scheduled at roughly 80% of `expiresIn` (e.g. ~12 minutes into a 15-minute token) via a timer, so an active user is refreshed transparently before their token actually expires — reactive (401-triggered) refresh remains the fallback for anything the timer misses (e.g. laptop sleep).

---

## D. RBAC Architecture

**The frontend's permission checks are UX convenience only. The backend remains authoritative** — restated because it governs every decision in this section: nothing here is a security boundary, all of it is "don't show a button that will 403 anyway."

### D.1 — The actual permission strings (transcribed from `@Permissions(...)` decorators this session, not invented)

```
Administration:departments:{view,create,edit,delete}
Administration:employees:{view,create,edit,delete}
Administration:roles:manage
Administration:users:manage

CRM:customers:{view,create,edit,delete}
CRM:leads:{view,create,edit,delete}
CRM:opportunities:{view,create,edit,delete}
CRM:quotations:{view,create,edit,delete,send,accept,reject}

Operations:projects:{view,create,edit,delete,assign}
Operations:project_members:{view,manage}
Operations:work_orders:{view,create,edit,delete,assign}
Operations:tasks:{view,create,edit,delete,assign}
```

43 distinct strings total. `POST /leads/:id/convert` is the **one** endpoint requiring two permissions simultaneously (`CRM:leads:edit` AND `CRM:customers:create`, confirmed in `leads.controller.ts`) — the frontend's convert-lead action button must check both, not just one.

**Dashboard is the one exception to "one permission per route"** — `/dashboard/summary` has no `@Permissions()` decorator at all; it does its own OR-based check server-side (`CRM:customers:view` OR `Operations:projects:view`, confirmed in `dashboard.service.ts`). The frontend's Dashboard page must replicate this OR logic specifically for that one page, not the AND-everything-required pattern used everywhere else.

### D.2 — Seeded roles (for reference/testing only — the frontend never hardcodes role names, only checks permissions)

Confirmed from `020_seed_roles_permissions.sql`: **Super Admin** (all permissions), **Manager** (currently only `Administration:departments:{view,edit}` + `Administration:employees:{view,edit}` — confirmed still the case, unchanged since Phase 2B, still an open item per your own prior review), **Sales** (all `CRM:*`), **Operations** (all `Operations:*`), **Employee** (none).

### D.3 — Route protection
Each route in the map (section I) declares its required permission(s) in `routeMap.ts` (the single source of truth also used for menu generation, section B). `<ProtectedRoute requiredPermissions={[...]}>` checks `AuthContext.permissions` (an array of the same flattened strings the backend already computes at login — no re-derivation on the frontend) and renders the `/403` page's *sibling* — a distinct "you don't have access to this section" state — if missing, without making an API call first.

### D.4 — Menu visibility
The sidebar (section F) filters its item list against `AuthContext.permissions` using the same `routeMap.ts` metadata — a menu item for a route the user lacks permission for is not rendered at all (not shown-disabled), consistent with "don't imply capability that will just 403."

### D.5 — Page-level permission checks
A page component checks its own required permission(s) before firing its primary data query — prevents a wasted round-trip. `usePermissions()` hook exposes `hasPermission(perm)` / `hasAnyPermission([...])` / `hasAllPermissions([...])`.

### D.6 — Action/button permission checks
`<PermissionGate requires={['CRM:quotations:send']}>` wraps individual buttons/actions (Send/Accept/Reject on a quotation, Assign on a work order, Delete anywhere) — renders nothing (not a disabled button) when the permission is absent, matching the menu-visibility philosophy.

---

## E. Multi-Tenant Architecture

**The company/tenant is never client input, anywhere in this design.** This section exists mainly to state that constraint explicitly and show there is no code path that violates it:

- `companyId` is read exactly once per session, from the `user.companyId` field in the login response / `AuthContext`, and is **never** rendered as an editable form field, **never** included in any request body or query string the frontend constructs, and **never** stored in a way a user could edit to bypass isolation — it wouldn't matter even if a value were tampered with client-side, since the backend derives its own `companyId` server-side from the token and ignores any client value entirely (confirmed across every DTO in the backend this session and in every prior audit).
- No component, form, or API call in this design ever needs to know or send `companyId` — every backend endpoint already scopes by it automatically from the authenticated session. This is a **structural** guarantee (there is no `companyId` field anywhere in `types/entities/*` request shapes, mirroring the backend DTOs exactly per section L), not a discipline the frontend team has to remember to maintain.
- The one place `companyId` is *read* (not sent) on the frontend is optional cosmetic use — e.g. showing "Company: Acme Inc." somewhere in the topbar. **No `GET /companies/:id`-style endpoint currently exists in the backend** (Companies is read-only via auth context only, confirmed — no dedicated controller). If company branding display is wanted beyond what's already in `AuthContext`, that's a backend gap to flag, not something the frontend can invent around.

---

## F. Main Application Layout

| Element | Design |
|---|---|
| **Login** | Centered card on `AuthLayout` (no sidebar/topbar) — email + password, inline validation errors, a "show password" toggle, no "remember me" beyond the refresh-token's own lifetime (no additional persistent-session concept exists in the backend to hook into). |
| **Dashboard** | Landing page after login. Renders section-by-section per the RBAC OR-logic in D.1 — a Sales-only user sees the CRM KPI cards; an Operations-only user sees the Operations cards; both → full grid. Uses the `/dashboard/summary` endpoint's actual returned keys (confirmed omitted-not-zeroed for unauthorized sections, so the frontend must render "nothing" for a missing key, not a zero). |
| **Sidebar** | Collapsible, sections generated from `routeMap.ts` filtered by D.4. Top-level groups: Dashboard, CRM (Customers/Leads/Opportunities/Quotations), Operations (Projects/Work Orders/Tasks), Administration (Departments/Employees/Users/Roles) — matching the backend's own module boundaries, not an arbitrary IA. |
| **Topbar** | Breadcrumbs (left), search (center, optional per-page), notifications bell + user menu (right). |
| **Breadcrumbs** | Derived from `routeMap.ts` route metadata + the current resource's display name (e.g. `Customers / Acme Inc. / Contacts`) — fetched lazily only when a detail page needs to show a real name rather than an ID. |
| **Notifications** | A bell icon with unread count, backed by `GET /notifications`. **Flagged**: no notifications list/read endpoint currently exists in the backend's implemented controllers (only internal `notification.create()` calls exist, e.g. in Quotations/Operations services, confirmed this session — there is no `NotificationsController`). This is a **real gap between what this phase's brief lists as backend-complete and what's actually implemented** — see section P, this needs your decision before the Notifications UI can be built against anything real. |
| **User menu** | Name/email (from `AuthContext`), Logout action. (Profile settings: no such endpoint exists either — not designed into this phase.) |
| **Responsive mobile navigation** | Sidebar collapses to a slide-over drawer below a Tailwind `md` breakpoint; topbar remains fixed; no bottom tab bar added — this is a responsive web app per instruction M, not a distinct mobile UI. |
| **Loading states** | Skeleton placeholders matching each component's real layout (table skeleton for DataTable, card skeleton for Dashboard KPI cards) — never a generic full-page spinner for anything below the initial app-shell load. |
| **Empty states** | A dedicated `<EmptyState>` component (section K) — e.g. "No customers yet" with a "Create Customer" call-to-action gated by the same `PermissionGate` as the page's create button, so a role without `CRM:customers:create` sees the empty message without a button that would 403. |
| **Error states** | A dedicated `<ErrorState>` distinguishing "this specific list failed to load, try again" from the full `/403`/`/401` redirect pages — a failed widget on Dashboard shouldn't take down the whole page. |

---

## G. Internationalization

**English and Arabic from day one**, per instruction.

- **Structure**: `i18n/en/*.json` and `i18n/ar/*.json`, namespaced by feature (`common.json`, `auth.json`, `customers.json`, `leads.json`, `opportunities.json`, `quotations.json`, `projects.json`, `workOrders.json`, `tasks.json`, `administration.json`, `dashboard.json`, `validation.json`) rather than one monolithic file — keeps translations reviewable and lets a translator work on one feature area without touching everything.
- **RTL/LTR**: a single `dir="rtl"`/`dir="ltr"` attribute on `<html>`, driven by the active language via `react-i18next`'s language-change event. Tailwind's logical properties (`ms-`/`me-`/`ps-`/`pe-` instead of `ml-`/`mr-`/`pl-`/`pr-`) used throughout components so spacing/alignment flips automatically — no component-level RTL branching logic.
- **Language switcher**: in the topbar user menu, persists the choice (localStorage), defaults to browser language on first visit, falls back to English if neither is Arabic.
- **Translated navigation**: every sidebar/breadcrumb label is a translation key, never a literal string — enforced by an ESLint rule against hardcoded JSX text where practical (a Phase 3A *design* decision to adopt, not something enforced by this document itself).
- **Translated validation/error messages**: the frontend does not display the backend's raw error message strings directly for validation failures — instead, it maps the backend's structured `class-validator` error output (property + constraint) to a translation key (e.g. `validation.email.invalid`), so the same 400 response renders correctly in either language. For non-validation errors (409/422/500 business-rule messages, which are free-text on the backend, e.g. "This quotation was already converted to customer X"), the raw backend message is shown as-is with a translated *prefix* ("Error: ") — those specific messages are not pre-translated on the frontend, since translating dynamically-interpolated backend strings correctly would require the backend to emit structured error codes for every business rule, which it currently does not (confirmed — business-rule exceptions are free-text `message` strings, not codes, across every service inspected this session). **Flagged as a real backend-frontend contract gap, not a frontend decision to resolve unilaterally — see section P.**
- **Date/number formatting**: `Intl.DateTimeFormat`/`Intl.NumberFormat` with the active locale (`en-US`/`ar-SA` as a starting pair, adjustable), never manual date-string concatenation. Currency formatting specifically must consume the backend's already-rounded `Decimal.toFixed(2)` string values as-is (never re-parse them as JS floats and reformat — this would reintroduce exactly the floating-point risk the backend's `QuotationCalculator`/`DashboardService` were built to avoid, per the Phase 2C/2E design docs).

### Enum/status label strategy (explicitly required by the brief — "do not translate database values blindly")

Backend status/stage/priority values are lowercase snake_case strings (`in_progress`, `qualification`, `on_hold`, etc.) — these are **never** displayed raw, and **never** translated by treating the raw string as if it were English prose. Instead: a single `statusLabels.ts` mapping table, keyed by `{ entity: 'project', value: 'in_progress' }` → a translation key (`project.status.in_progress`) → the actual localized label. This gives three benefits confirmed against the actual backend enums this session:
1. **Reuses the backend's exact status vocabulary** — the same 6 status/stage lists transcribed in section L.1, so a frontend enum can never silently drift from what the backend's `WorkflowTransitionValidator` actually accepts.
2. **Decouples display text from the wire value** — "In Progress" in English, "قيد التنفيذ" in Arabic, both mapped from the same `in_progress` value, with zero risk of someone typo-translating the *value* sent back to the API instead of just the label.
3. **`<StatusBadge>`/`<PriorityBadge>`** (section K) consume this table directly rather than each call site doing its own switch/if-chain — one place to add a new status if the backend ever adds one (with the corresponding change also needing to land in `WorkflowTransitionValidator`, keeping both sides honest).

---

## H. White-Label / Multi-Company UI

A `config/branding.ts` + `config/theme.ts` layer, loaded once at app startup, consumed by every component that currently might be tempted to hardcode "Arkan" or any specific company's identity:

- **Company name, logo, favicon**: resolved from a build-time or runtime config object (`{ companyName, logoUrl, faviconUrl }`) — not hardcoded in `index.html`, `AppLayout`, or anywhere else. **Flagged**: the backend currently has no endpoint exposing `companies.logo`/`companies.name` to an authenticated frontend session (Companies is not a queryable resource, per section E) — so for V1, this configuration is necessarily a **frontend-only, deploy-time** config (one build per company, or an environment-variable-driven config if multiple companies share one deployment), not something fetched live from the backend per-tenant. This is worth your explicit confirmation since it affects how "white-label" actually works operationally — see section P.
- **Primary/secondary color, theme**: CSS custom properties (`--color-primary`, `--color-secondary`, etc.) set from the same config object, consumed by Tailwind via its `theme.extend.colors` referencing the CSS variables — changing a company's palette is a config value change, not a component edit, anywhere in the app.
- **Default language**: part of the same config, overridable per-user via the language switcher (section G) but company-configurable as the starting default.
- **Terminology**: the i18n layer (section G) already namespaces every label through translation keys — a white-label deployment that wants "Clients" instead of "Customers," for instance, is a translation-file override, not a component change. This is the same mechanism as language translation, just potentially a same-language "translation" (English → different English wording) — no separate mechanism needed.

---

## I. Route Map

Every route below maps to a backend capability **confirmed to actually exist** this session (route path, controller, and permission transcribed directly from the controller source — nothing inferred or assumed).

### Authentication
| Frontend route | Backend capability |
|---|---|
| `/login` | `POST /api/v1/auth/login` |
| *(no route — background)* | `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` |
| `/403` | client-side only, rendered on a confirmed backend 403 |

### Dashboard
| Frontend route | Backend capability | Required permission |
|---|---|---|
| `/dashboard` | `GET /api/v1/dashboard/summary` | `CRM:customers:view` OR `Operations:projects:view` (D.1) |
| `/dashboard/sales` | `GET /api/v1/dashboard/sales` | `CRM:customers:view` |
| `/dashboard/operations` | `GET /api/v1/dashboard/operations` | `Operations:projects:view` |
| `/dashboard/workload` | `GET /api/v1/dashboard/workload` | `Operations:projects:view` |

### Administration
| Frontend route | Backend capability | Required permission |
|---|---|---|
| `/admin/departments` | `GET/POST /api/v1/departments` | `Administration:departments:view`/`create` |
| `/admin/departments/:id` | `GET/PATCH/DELETE /api/v1/departments/:id` | `Administration:departments:view`/`edit`/`delete` |
| `/admin/employees` | `GET/POST /api/v1/employees` | `Administration:employees:view`/`create` |
| `/admin/employees/:id` | `GET/PATCH/DELETE /api/v1/employees/:id`, `POST /api/v1/employees/:id/link-user` | `Administration:employees:*` |
| `/admin/users` | `GET/POST /api/v1/users` | `Administration:users:manage` |
| `/admin/users/:id` | `GET/PATCH/DELETE /api/v1/users/:id` | `Administration:users:manage` |
| `/admin/roles` | `GET/POST /api/v1/roles` | `Administration:roles:manage` |
| `/admin/roles/:id` | `GET /api/v1/roles/:id`, `POST /api/v1/roles/:id/permissions`, `POST /api/v1/roles/assign`, `DELETE /api/v1/roles/user/:userId/role/:roleId` | `Administration:roles:manage` |
| *(reference only, no dedicated page)* | `GET /api/v1/permissions` | `Administration:roles:manage` — consumed by the role-editing page's permission picker, not its own route |

### CRM
| Frontend route | Backend capability | Required permission |
|---|---|---|
| `/crm/customers` | `GET/POST /api/v1/customers` | `CRM:customers:view`/`create` |
| `/crm/customers/:id` | `GET/PATCH/DELETE /api/v1/customers/:id` | `CRM:customers:*` |
| `/crm/customers/:id/contacts` | `GET/POST /api/v1/customers/:id/contacts`, `PATCH/DELETE .../:contactId` | `CRM:customers:view`/`edit` |
| `/crm/customers/:id/portal-users` | `GET/POST /api/v1/customers/:id/portal-users`, `POST .../link-existing`, `DELETE .../:customerUserId` | `CRM:customers:view`/`edit` |
| `/crm/leads` | `GET/POST /api/v1/leads` | `CRM:leads:view`/`create` |
| `/crm/leads/:id` | `GET/PATCH/DELETE /api/v1/leads/:id`, `PATCH .../status`, `POST .../convert` | `CRM:leads:*` (convert also needs `CRM:customers:create`) |
| `/crm/opportunities` | `GET/POST /api/v1/opportunities` | `CRM:opportunities:view`/`create` |
| `/crm/opportunities/:id` | `GET/PATCH/DELETE /api/v1/opportunities/:id`, `PATCH .../stage` | `CRM:opportunities:*` |
| `/crm/quotations` | `GET/POST /api/v1/quotations` | `CRM:quotations:view`/`create` |
| `/crm/quotations/:id` | `GET/PATCH/DELETE /api/v1/quotations/:id`, `POST .../send`,`.../accept`,`.../reject`,`.../expire` | `CRM:quotations:*` (per-action) |
| `/crm/quotations/:id` (items sub-section, same page) | `POST/PATCH/DELETE /api/v1/quotations/:id/items[/:itemId]` | `CRM:quotations:edit` |

### Operations
| Frontend route | Backend capability | Required permission |
|---|---|---|
| `/ops/projects` | `GET/POST /api/v1/projects` | `Operations:projects:view`/`create` |
| `/ops/projects/:id` | `GET/PATCH/DELETE /api/v1/projects/:id`, `PATCH .../status`, `POST .../assign-manager` | `Operations:projects:*` |
| `/ops/projects/:id/members` (same page, tab) | `GET/POST /api/v1/projects/:id/members`, `PATCH/DELETE .../:employeeId` | `Operations:project_members:view`/`manage` |
| `/ops/work-orders` | `GET/POST /api/v1/work-orders` | `Operations:work_orders:view`/`create` |
| `/ops/work-orders/:id` | `GET/PATCH/DELETE /api/v1/work-orders/:id`, `PATCH .../status`, `POST .../assign` | `Operations:work_orders:*` |
| `/ops/tasks` | `GET/POST /api/v1/tasks` | `Operations:tasks:view`/`create` |
| `/ops/tasks/:id` | `GET/PATCH/DELETE /api/v1/tasks/:id`, `PATCH .../status`, `POST .../assign` | `Operations:tasks:*` |

**No routes exist for**: a standalone Notifications page/list, a standalone Activity Log viewer, or any Customer Portal-facing page — none of these have a corresponding backend endpoint today (confirmed this session; Activity Logs and Notifications are written internally but have no `Controller` at all). Flagged in section P.

---

## J. API Integration

**No component makes a raw `fetch`/`axios` call.** Every request flows through exactly two layers:

**Layer 1 — `api/client.ts`**: a single configured Axios instance.
- Request interceptor: attaches `Authorization: Bearer <accessToken>`.
- Response interceptor: unwraps the backend's `{ data, meta, errors }` envelope (confirmed exact shape this session from `response.interceptor.ts`) so callers work with plain typed data, not the envelope; on a non-2xx response, normalizes `{ data: null, meta: null, errors: [{ code, message }] }` (confirmed exact shape from `http-exception.filter.ts`) into a single `ApiError` class with `.status`, `.code`, `.message`.
- The 401-refresh-retry queue described in section C lives here.

**Layer 2 — `api/endpoints/*.ts`**: one typed function per backend route, e.g.:
```ts
// api/endpoints/quotations.ts
export const quotationsApi = {
  list: (params: QuotationFilters) => client.get<Quotation[]>('/quotations', { params }),
  get: (id: string) => client.get<Quotation>(`/quotations/${id}`),
  create: (body: CreateQuotationInput) => client.post<Quotation>('/quotations', body),
  update: (id: string, body: UpdateQuotationInput) => client.patch<Quotation>(`/quotations/${id}`, body),
  remove: (id: string) => client.delete(`/quotations/${id}`),
  send: (id: string) => client.post<Quotation>(`/quotations/${id}/send`),
  accept: (id: string) => client.post<Quotation>(`/quotations/${id}/accept`),
  reject: (id: string) => client.post<Quotation>(`/quotations/${id}/reject`),
  expire: (id: string) => client.post<Quotation>(`/quotations/${id}/expire`),
};
```
`QuotationFilters` here is the frontend mirror of the actual `QuotationFiltersDto` (confirmed fields: `customerId`, `opportunityId`, `status`, plus the inherited `page/pageSize/sortBy/sortDir/search`) — not a guess at what filtering "should" look like.

**Layer 3 — `api/queries/*.ts`**: React Query hooks wrapping Layer 2, e.g. `useQuotations(filters)`, `useQuotation(id)`, `useCreateQuotation()`, `useSendQuotation()` — this is what pages/components actually import.

### Cross-cutting behaviors, one implementation each
- **Pagination**: every list endpoint returns `meta: { page, pageSize, total, totalPages }` (confirmed exact shape from `buildMeta()` this session) — a single `<Pagination>` component (section K) consumes this shape universally; no page reimplements page-number math.
- **Filters**: each resource's filter DTO (confirmed field lists per resource: Projects → `customerId, status`; WorkOrders → `projectId, status, assignedToEmployeeId`; Tasks → `projectId, workOrderId, status, assignedToEmployeeId`; Opportunities → `customerId, stage`; Quotations → `customerId, opportunityId, status`; Dashboard → `dateFrom, dateTo, departmentId, employeeId, customerId, projectId, status, priority`) becomes a typed `FilterBar` config per page — the frontend never sends a filter field the backend doesn't declare, since (per the backend's own P1 fix) an undeclared query param is now rejected with 400 by the whitelist pipe, not silently ignored.
- **Sorting**: `sortBy`/`sortDir` — generic, part of `PaginationQueryDto`, consumed by `<DataTable>`'s column-header click handler.
- **Search**: `search` — generic free-text param, present on every list DTO inspected.
- **Validation errors (400)**: mapped field-by-field from the backend's `class-validator` error format onto the React Hook Form + Zod form state — a 400 on submit re-surfaces as inline field errors, not a toast.
- **401**: handled globally by the interceptor (section C), invisible to individual pages.
- **403**: the specific request's error is caught by React Query's `onError`/`isError`, rendered via `<ErrorState variant="forbidden">` or a redirect to `/403` for a page's *primary* query specifically (a secondary widget's 403 just hides that widget).
- **404**: rendered via `<ErrorState variant="not-found">` for a detail page; a list page's 404 (shouldn't normally happen) treated the same as any other list-load error.
- **409**: shown as a toast/inline message using the backend's actual message text (e.g. duplicate customer code, duplicate quotation-project link, already-converted lead) — these are point-in-time conflicts, not persistent form errors, so they don't attach to a specific field.
- **422**: business-rule violations (invalid workflow transition, completion gating blocked, manager-cycle rejected, customer-delete blocked by active projects) — shown as a prominent inline banner on the action being attempted (e.g. on the status-change control itself), using the backend's message text, since these are exactly the free-text business messages described in section G as not pre-translatable without a backend contract change.
- **500**: a generic "something went wrong, try again" `<ErrorState>`, logged to the browser console (and, later, to a real error-tracking service — not designed in this phase) — never shows a raw stack trace to the user.

---

## K. Reusable Components

| Component | Notes |
|---|---|
| `DataTable` | Generic, column-config-driven; consumes `meta` for pagination, `sortBy/sortDir` for header sorting; renders `EmptyState`/`LoadingState`/`ErrorState` internally based on query status — a page just passes columns + a query hook result. |
| `Pagination` | Consumes `{ page, pageSize, total, totalPages }` exactly as returned by `buildMeta()` — no reimplementation of the math per page. |
| `SearchBar` | Debounced (via `useDebounce`), writes to the `search` query param. |
| `FilterBar` | Config-driven per resource (field list + type: select/date-range/uuid-picker), built from each resource's actual `*FiltersDto` field list (J) — not a generic "any filter" builder, since the backend only accepts specific declared fields per endpoint. |
| `Modal` | Radix Dialog primitive + Tailwind, used for create/quick-edit flows that don't warrant a full page. |
| `Drawer` | Radix-based slide-over, used for detail "peek" views (e.g. a task's detail without leaving the Work Order's task list) and mobile navigation (section F). |
| `Form` | React Hook Form + Zod wrapper providing consistent field layout, label, error message, and required-indicator — every create/edit form composes this rather than hand-rolling layout. |
| `ConfirmDialog` | Used before every delete action and before certain 422-risking transitions (e.g. completing a work order/project) — a generic "Are you sure?" with a customizable message, not a native `window.confirm`. |
| `StatusBadge` | Consumes `statusLabels.ts` (section G) — color + label per entity+status combination, e.g. `on_hold` renders differently for a Project vs. a Work Order even though it's the same string value, since color-coding conventions may reasonably differ per entity. |
| `PriorityBadge` | Same pattern, for the shared `low/medium/high/urgent` priority enum used identically by Work Orders and Tasks (confirmed identical enum in both `WorkOrderFiltersDto` and `TaskFiltersDto`). |
| `EmptyState` | Icon + message + optional `PermissionGate`-wrapped call-to-action. |
| `LoadingState` | Skeleton variants (table row, card, detail page) — no generic spinner as the default. |
| `ErrorState` | Variants: `generic`, `not-found`, `forbidden`, `network` — chosen by the calling component based on the actual `ApiError.status`. |
| `PageHeader` | Title + breadcrumb slot + primary-action-button slot (itself `PermissionGate`-wrapped). |
| `PermissionGate` | Section D.6 — the RBAC primitive every other gated UI element is built from. |

---

## L. Data Model / Types

**Types mirror the backend's actual DTOs field-for-field — confirmed this session, nothing invented.** Representative excerpts (not the full set, which is 1:1 with every DTO file inspected):

### L.1 — Status/stage/priority enums (transcribed from `workflow-transition.validator.ts` this session)
```ts
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost';
type OpportunityStage = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost';
type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
type ProjectStatus = 'planning' | 'approved' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
type WorkOrderStatus = 'new' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
```

### L.2 — Auth context (transcribed verbatim from `request-context.interface.ts`)
```ts
interface AuthContext {
  sub: string;
  companyId: string;
  email: string;
  employeeId?: string;
  roles: string[];
  permissions: string[];
  isCustomerUser: boolean;
  customerId?: string;
}
```

### L.3 — API envelope (transcribed from `response.interceptor.ts` / `http-exception.filter.ts`)
```ts
interface ApiResponse<T> { data: T; meta: PaginationMeta | null; errors: null; }
interface ApiErrorResponse { data: null; meta: null; errors: Array<{ code: string; message: string | string[] }>; }
interface PaginationMeta { page: number; pageSize: number; total: number; totalPages: number; }
```

### L.4 — Financial values
Confirmed this session: `opportunities.value`, `quotations.subtotal/discount/tax/total` are serialized by the backend as **decimal strings** (`Decimal.toFixed(2)`, per `QuotationCalculator`/`DashboardService`), not JS numbers. Frontend types reflect this exactly (`total: string`, not `total: number`) — formatting/display uses the string directly or `Intl.NumberFormat` after a single controlled parse, never arithmetic on it client-side beyond display formatting (matches the backend's own "never JS float math on money" rule, extended to the frontend for consistency, not because the frontend does the arithmetic).

Full type inventory (all ~23 entities + all create/update DTOs + all filter DTOs) to be generated during 3B–3E implementation, one file per resource in `types/entities/`, each cross-checked against its backend DTO file at time of writing — not fabricated ahead of time in this design pass.

---

## M. Responsive Design

Desktop-first (this is an internal business admin tool, not a consumer app), with tested breakpoints at:
- **Desktop** (≥1024px): full sidebar + multi-column DataTables/forms.
- **Tablet** (768–1023px): collapsible sidebar (icon-only by default), single-column forms, DataTables scroll horizontally rather than reflowing.
- **Android/mobile browser** (<768px): sidebar becomes the slide-over drawer (section F), DataTables switch to a stacked card layout per row (not horizontal scroll — unreadable at that width for tables with 6+ columns like Work Orders), forms remain single-column with larger touch targets.

**No separate mobile application in this phase** — confirmed as an explicit instruction, not a decision made here.

---

## N. Security

- **Never store passwords**: the frontend never persists a password anywhere beyond the login form's own in-memory field state, cleared immediately on submit — not in Redux/Context/localStorage/sessionStorage, not even transiently for a "remember me" convenience feature (none is designed).
- **Never trust frontend permissions**: restated from section D — every RBAC check here is UX only; a determined user editing the frontend's JS in devtools gains nothing, since the backend independently re-checks every permission on every request.
- **Never trust `companyId` from form input**: restated from section E — there is structurally no form field for it anywhere in this design.
- **Token storage**: access token and refresh token stored in memory (React state/Context) as the primary copy, with the refresh token *additionally* persisted to `localStorage` (not `sessionStorage`, so a session survives a tab close, matching typical expectations for an admin tool) purely to support session restoration on reload — **flagged as a decision requiring your confirmation** (section P): `localStorage` is readable by any JS running on the page, which is an acceptable-but-not-zero-risk tradeoff against XSS (below) common to most SPA architectures without a backend-set httpOnly cookie option, which this backend does not currently offer (it returns tokens in the JSON body, not as cookies, confirmed via `AuthService.issueTokenPair`) — an httpOnly-cookie-based refresh flow would be more secure but is a backend change, out of scope for this design-only phase.
- **XSS considerations**: React's default JSX escaping handles the overwhelming majority of injection risk; the two places raw content could enter are (a) any `dangerouslySetInnerHTML` usage — **none is planned anywhere in this design**, all "free text" fields (quotation descriptions, task descriptions, comments if the System module is later built) render as plain escaped text — and (b) the business-rule error messages described in section G/J, which are backend-controlled strings but should still be rendered as text nodes, never interpreted as HTML, even though they currently originate from a trusted first-party backend.
- **Safe logout**: section C — clears client state regardless of whether the server-side revocation call itself succeeds, so a network blip during logout can never leave stale tokens "logically logged out but still technically valid" in frontend memory believing otherwise.
- **API error handling**: section J — no raw backend stack traces or internal error details are ever surfaced to the UI; 500s are generically messaged.

---

## O. Implementation Order

| Phase | Scope |
|---|---|
| **3A** | This document — foundation design only. No code. |
| **3B** | Project scaffold (Vite + React + TS + Tailwind + Router + React Query), `api/client.ts` + auth flow end-to-end (login → session restore → logout → protected routes), `AppLayout`/`Sidebar`/`Topbar` shell, `PermissionGate`/`usePermissions`, i18n scaffold (en/ar, RTL toggle) — the "can a user log in and see an empty shell correctly gated by their real permissions" milestone. |
| **3C — Dashboard** | `/dashboard` + the three sub-pages, KPI cards, the RBAC-OR-logic special case (D.1), zero-filled-bucket chart rendering, filter bar. |
| **3D — CRM** | Customers (+ Contacts + Portal Users sub-resources), Leads (+ conversion flow as a `features/lead-conversion` multi-step UI), Opportunities, Quotations (+ line-item editor with live Decimal-safe total calculation mirroring the backend, + the send/accept/reject/expire action flows). |
| **3E — Operations** | Projects (+ Members sub-resource + manager-assignment flow), Work Orders (+ assignment), Tasks (+ assignment), the shared completion-gating UX (surfacing the backend's strict-no-override 422s clearly, per the approved V1 design decision that there is no override). |
| **3F — Administration** | Departments, Employees (+ user-linking), Users, Roles (+ permission-assignment UI consuming `GET /permissions`). |
| **3G — Final UI polish** | Cross-cutting: loading/empty/error state audit across every page, responsive QA pass (section M breakpoints), full en/ar translation completeness pass, accessibility pass (keyboard nav, focus management in Modal/Drawer, ARIA on DataTable). |

Administration is placed **after** CRM/Operations (not before, despite being alphabetically "first") because Employees/Departments are referenced *by* CRM/Operations (assignee pickers, manager pickers) but don't themselves depend on those modules — building the referencing UIs first surfaces exactly what the picker components need, then Administration's own CRUD pages are comparatively simple once those patterns exist. Flagged as a sequencing choice, not mandated by the brief's lettering — confirm in section P if you'd rather follow strict A→F module order instead.

---

## P. Decisions Requiring Your Approval

Only genuine open decisions — not implementation details already settled by inspection:

1. **Framework choice (React + Vite + TS)** — a preference based on your other project's tooling, not derived from the backend. Confirm, or specify a different framework.
2. **Notifications and Activity Log UI have no backend endpoint to build against.** Confirmed this session: `activity_logs`/`notifications` tables are written to extensively but have zero `Controller`/route exposing them for reading. Options: (a) defer both from the frontend entirely until a System module backend phase adds the endpoints, (b) you decide the frontend should proceed with mocked/placeholder UI now, or (c) a small backend addition is prioritized first. **This blocks any real Notifications bell or Activity Log page regardless of frontend framework choice.**
3. **White-label branding (company name/logo/colors) has no backend endpoint either** — confirmed Companies has no dedicated controller. Per-company branding must be a frontend-only, deploy-time configuration for V1 (one build/config per company), not a live per-tenant fetch. Confirm this operational model is acceptable, or decide a minimal `GET /companies/:id`-style read endpoint should be added to the backend first (a backend change, out of scope for this design phase to do unilaterally).
4. **Refresh token storage in `localStorage`** (vs. an httpOnly cookie the current backend doesn't support) — a common, but not risk-free, SPA pattern given the backend's current token-in-JSON-body design. Confirm acceptable for V1, or flag that a backend change (cookie-based refresh) should be considered before frontend work begins.
5. **Business-rule (409/422) error messages are shown in raw backend English text**, not translated, since the backend emits free-text messages rather than structured error codes for these cases (section G/J). Confirm this is acceptable for the Arabic UI in V1 (an English sentence appearing inside an otherwise-Arabic interface), or flag that the backend should be extended to emit error *codes* for business-rule violations so the frontend can translate them properly — again a backend change, out of scope here.
6. **Implementation order places Administration last** (section O) — a sequencing rationale, not a hard requirement; confirm or reorder.
7. **Desktop-first responsive strategy** (section M) rather than mobile-first — reasonable for an internal admin tool per your own instruction that no separate mobile app is wanted, but worth an explicit confirmation since it affects early component design decisions (e.g. DataTable's mobile card-layout fallback needs to be designed in from the start, not bolted on later).

No other decisions in this document required your input beyond what's listed above — everything else follows directly and unambiguously from the backend as it actually exists today.

