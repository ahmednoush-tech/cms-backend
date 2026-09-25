# Phase 2E — Dashboard Design

**Status: documentation only.** No application code, database tables, or migrations were written in the preparation of this document. Every field name below was re-read directly from `prisma/schema.prisma` before writing this, not recalled from memory. `schema.prisma`'s checksum and the migration count (25) were confirmed unchanged immediately before writing this and will be re-confirmed immediately after.

Scope: read-only aggregation queries against the tables already approved and implemented in Phases 2A-2D. **The Dashboard has no tables of its own** — every number below is computed live from `companies`, `customers`, `leads`, `opportunities`, `quotations`, `quotation_items`, `projects`, `work_orders`, `tasks`, and `employees`.

---

## 1-3. KPI Definitions

Every KPI is documented with: **source table(s)**, **filter conditions**, **date field used**, and **calculation**. This satisfies item 14 (accuracy) inline rather than as a separate section, so each KPI's definition and its accuracy proof live together.

### 1. Executive KPIs

| KPI | Source | Condition | Date field | Calculation |
|---|---|---|---|---|
| Total Customers | `customers` | `deletedAt IS NULL` | none (point-in-time count) | `COUNT(*)` |
| New Leads | `leads` | `deletedAt IS NULL`, `createdAt` within selected date range | `created_at` | `COUNT(*)` |
| Open Opportunities | `opportunities` | `deletedAt IS NULL`, `stage NOT IN ('won','lost')` | none | `COUNT(*)`. **Confirmed**: `opportunities` has no `status` column — `stage` is the sole state field (verified directly against `schema.prisma`, not assumed). This is item 14's explicit accuracy check, and it passes as-is; no schema change needed or proposed. |
| Pipeline Value | `opportunities` | `deletedAt IS NULL`, `stage NOT IN ('won','lost')` | none | `SUM(value)` using DB decimal arithmetic (see §9) |
| Active Projects | `projects` | `deletedAt IS NULL`, `status = 'in_progress'` | none | `COUNT(*)` |
| Completed Projects | `projects` | `deletedAt IS NULL`, `status = 'completed'` | none | `COUNT(*)` |
| Open Work Orders | `work_orders` | `deletedAt IS NULL`, `status NOT IN ('completed','cancelled')` | none | `COUNT(*)` |
| Overdue Work Orders | `work_orders` | `deletedAt IS NULL`, `status NOT IN ('completed','cancelled')`, `dueDate < NOW()` | `due_date` | `COUNT(*)`. A work order with `dueDate IS NULL` is never "overdue" — absence of a due date is not lateness. |
| Pending Tasks | `tasks` | `deletedAt IS NULL`, `status = 'pending'` | none | `COUNT(*)` |
| Completed Tasks | `tasks` | `deletedAt IS NULL`, `status = 'completed'` | none | `COUNT(*)` |
| Total Open Assignments | `work_orders` + `tasks` | Both filtered independently for non-terminal status and `assignedToEmployeeId IS NOT NULL` | none | **Two separate counts, summed only at display time** — see §7. Never a single combined SQL query across both tables. |

### 2. Sales / CRM KPIs

| KPI | Source | Condition | Date field | Calculation |
|---|---|---|---|---|
| Leads by status | `leads` | `deletedAt IS NULL` | `created_at` for range filtering | `GROUP BY status, COUNT(*)` — six buckets: `new, contacted, qualified, proposal, won, lost` |
| Opportunities by stage | `opportunities` | `deletedAt IS NULL` | `created_at` | `GROUP BY stage, COUNT(*)` — six buckets matching the approved stage enum |
| Pipeline value | `opportunities` | `deletedAt IS NULL`, `stage NOT IN ('won','lost')` | none | Same as Executive §1, repeated here for the Sales view's own context |
| Opportunities won/lost | `opportunities` | `deletedAt IS NULL`, `stage IN ('won','lost')`, optionally date-ranged | `updated_at` (proxy — `opportunities` has no dedicated `won_at`/`lost_at` column; flagged in Assumptions) | `COUNT(*) GROUP BY stage` |
| Conversion rate | `opportunities` | `deletedAt IS NULL` | `created_at` for the date-range | `COUNT(stage='won') / COUNT(stage IN ('won','lost')) * 100`. Still-open opportunities are excluded from both numerator and denominator — a win rate of *decided* opportunities, not "won / all ever created." Flagged as a definitional choice in Assumptions. |
| Quotations by status | `quotations` | `deletedAt IS NULL` | `created_at` | `GROUP BY status, COUNT(*)` — five buckets: `draft, sent, accepted, rejected, expired` |
| Quotation value by status | `quotations` | `deletedAt IS NULL` | `created_at` | `GROUP BY status, SUM(total)` using DB decimal arithmetic |
| Accepted quotation value | `quotations` | `deletedAt IS NULL`, `status = 'accepted'` | `updated_at` (same proxy caveat as won/lost opportunities) | `SUM(total)` |

### 3. Operations KPIs

| KPI | Source | Condition | Date field | Calculation |
|---|---|---|---|---|
| Projects by status | `projects` | `deletedAt IS NULL` | `created_at` | `GROUP BY status, COUNT(*)` — six buckets |
| Work Orders by status | `work_orders` | `deletedAt IS NULL` | `created_at` | `GROUP BY status, COUNT(*)` — six buckets |
| Work Orders by priority | `work_orders` | `deletedAt IS NULL` | none | `GROUP BY priority, COUNT(*)` — four buckets: `low, medium, high, urgent` |
| Overdue Work Orders | same as Executive §1 | | `due_date` | (repeated for the Operations view) |
| Tasks by status | `tasks` | `deletedAt IS NULL` | `created_at` | `GROUP BY status, COUNT(*)` — four buckets |
| Tasks by priority | `tasks` | `deletedAt IS NULL` | none | `GROUP BY priority, COUNT(*)` |
| Employee workload | `work_orders` + `tasks` | see §7 | none | Three separate aggregates, never one |
| Open tasks by employee | `tasks` | `deletedAt IS NULL`, `status NOT IN ('completed','cancelled')`, `assignedToEmployeeId IS NOT NULL` | none | `GROUP BY assignedToEmployeeId, COUNT(*)` |
| Open work orders by employee | `work_orders` | `deletedAt IS NULL`, `status NOT IN ('completed','cancelled')`, `assignedToEmployeeId IS NOT NULL` | none | `GROUP BY assignedToEmployeeId, COUNT(*)` |
| Total open assignments by employee | both above | | none | The two grouped results merged **in the service layer** by `employeeId`, never a SQL UNION/join — see §7 |

---

## 4. Filters

Global filters, and exactly which KPIs each one applies to:

| Filter | Applies to | Does NOT apply to | Mechanism |
|---|---|---|---|
| Date range | New Leads; Leads/Opportunities/Quotations/Projects/Work Orders/Tasks "by status" breakdowns (createdAt); Won/Lost Opportunities and Accepted Quotation Value (updatedAt) | Point-in-time counts: Total Customers, Open Opportunities, Pipeline Value, Active/Completed Projects, Open/Overdue Work Orders, Pending/Completed Tasks, all Employee Workload KPIs — these describe current state, not activity within a window (see §8) | `WHERE <date_field> BETWEEN :from AND :to`, applied only to the date field documented for that specific KPI |
| Department | Employee Workload (all three), Open/Completed Tasks, Open Work Orders — anything reachable through `assignedToEmployeeId -> employees.departmentId` | Customer/Lead/Opportunity/Quotation KPIs (no department relationship exists on those tables) | `JOIN employees ON assignedToEmployeeId = employees.id WHERE employees.departmentId = :departmentId` |
| Employee | Employee Workload (all three), Open Tasks/Work Orders by Employee (narrows to one employee's row) | Everything without an `assignedToEmployeeId` column | `WHERE assignedToEmployeeId = :employeeId` |
| Customer | Opportunities, Quotations, Projects, Work Orders (carry `customerId` directly) | Leads before conversion (nullable `customerId`), Tasks (no direct `customerId` — filtered via a join through `projectId`/`workOrderId` if applied) | `WHERE customerId = :customerId` |
| Project | Work Orders by status/priority, Tasks by status/priority, Employee Workload (narrowed to one project) | Leads, Opportunities, Quotations, Customers (no project relationship) | `WHERE projectId = :projectId` (direct on work_orders; tasks via `projectId` or transitively via `workOrderId`) |
| Status | Every "by status" breakdown KPI — narrows the `GROUP BY` to a single bucket | Point-in-time counts that are already status-conditioned by definition (e.g. "Active Projects" is already `status='in_progress'`; a status filter on it is a no-op, not an error) | `WHERE status = :status` |
| Priority | Work Orders by priority, Tasks by priority, and optionally any workload KPI narrowed to a priority tier | Leads, Opportunities, Quotations, Projects, Customers (no `priority` column) | `WHERE priority = :priority` |

All filters combine with `AND`, applied server-side inside each KPI's query builder — never as a post-fetch in-memory filter. Filter values referencing other entities are validated tenant-owned before use (§5).

---

## 5. Tenant Isolation

- Every query carries `companyId = :companyId` (or scopes through a table that already carries it) as the first condition, sourced exclusively from `AuthContext.companyId` — same mechanism used by every module since Phase 2A. Never from a query parameter, request body, or filter value.
- Filter values referencing other entities (`customerId`, `employeeId`, `projectId`, `departmentId`) are validated to belong to the caller's company before use, reusing the existing `assertXBelongsToCompany`-style helpers already built in CRM/Administration/Operations (`CustomersService`, `EmployeesService`, `ProjectsService`) — not reimplemented. A filter value from another tenant is rejected (400/404, consistent with every prior module), never silently ignored or silently applied.
- No Dashboard query ever accepts or trusts a `companyId` value from the request — same guarantee already proven at the HTTP level for every other module, to be proven the same way for Dashboard in implementation (§15).

---

## 6. RBAC

**Dashboard access does not create a new, wider window into the underlying data — it exposes the same data through the same permission boundaries already in place.**

- Reaching any Dashboard endpoint requires authentication and `@InternalOnly()` — customer-portal identities cannot reach any Dashboard route, same as every internal module.
- **Per-section gating, not one blanket "dashboard.view" permission**: each endpoint checks the permissions for the domain it exposes.
  - `GET /dashboard/sales` requires a CRM view permission — a user without CRM view access does not see CRM numbers just because they can reach the Dashboard route.
  - `GET /dashboard/operations` and `GET /dashboard/workload` require Operations view permissions.
  - `GET /dashboard/summary` (mixing both domains) requires **both** permission sets to see both halves — see the decision below for exact behavior when only one set is held.
- **Concrete role mapping given the existing seeded roles** (Super Admin, Manager, Sales, Operations, Employee):
  - Super Admin: full Dashboard, all sections.
  - Sales: `/dashboard/sales` only (has CRM view permissions, no Operations permissions).
  - Operations: `/dashboard/operations` + `/dashboard/workload` only (has Operations permissions, no CRM permissions).
  - Manager: currently seeded (Phase 2B) with only Administration `departments`/`employees` view/edit — under the letter of the existing seed data, a Manager sees **none** of the Dashboard sections unless CRM/Operations view permissions are also granted. Flagged now rather than silently assumed — an explicit permission grant should be added when Dashboard permissions are seeded.
  - Employee: sees nothing (no CRM/Operations view permissions currently seeded).

### Decision requiring your approval
Two options for `/dashboard/summary` when the caller has only partial permissions:
- **(A)** Return the sections they're permitted to see, with the rest omitted from the JSON body (partial response, 200).
- **(B)** Require both CRM and Operations view permissions to call `/summary` at all, otherwise 403 — the narrower endpoints (`/sales`, `/operations`, `/workload`) remain independently accessible to whoever holds the matching single-domain permission.

Proposed default: **(B)** — a partial 200 could be mistaken by a frontend for "there is no CRM data" rather than "you can't see CRM data," which is a worse failure mode than an explicit 403 pointing the user at the narrower endpoint they can actually call.

---

## 7. Employee Workload — Kept as Three Separate Concepts

Restated as the binding design, per your explicit instruction:

1. **Open Tasks by Employee** — `SELECT assignedToEmployeeId, COUNT(*) FROM tasks WHERE company_id=:companyId AND deleted_at IS NULL AND status NOT IN ('completed','cancelled') AND assigned_to_employee_id IS NOT NULL GROUP BY assigned_to_employee_id`
2. **Open Work Orders by Employee** — the identical shape against `work_orders`.
3. **Total Open Assignments by Employee** — **not** a third query against a unioned/joined result. It is the two result sets above, fetched independently, then merged in the service layer by `employeeId`:
   ```
   total[employeeId] = (openTasksByEmployee[employeeId] ?? 0) + (openWorkOrdersByEmployee[employeeId] ?? 0)
   ```
   This guarantees a task and a work order are never treated as interchangeable units of the same underlying record — they remain two distinct counts that happen to be summed for display, not two rows unioned into a query that could double-count. If a future phase adds a third assignable entity, only that entity's own query needs to be added to the merge — no existing query changes.

---

## 8. Date Semantics — Every KPI's Date Field, Explicitly

Four date fields exist across Operations/CRM entities that could plausibly back a date-range filter; each is used deliberately, not interchangeably:

| Date field | Used by | Why this one and not another |
|---|---|---|
| `created_at` | New Leads; Leads/Opportunities/Quotations/Projects/Work Orders/Tasks "by status" breakdowns | Answers "what happened in this window" — creation is the unambiguous start of an entity's life in the system |
| `due_date` | Overdue Work Orders | The only field that defines lateness; `completed_at`/`created_at` cannot substitute |
| `completed_at` | documented as available, not used by any KPI in this initial set | Reserved for a future "completions this month" KPI if requested — not built now, not silently added |
| `expected_close_date` | documented as available, not used by any KPI in this initial set | Would back a future "opportunities expected to close this quarter" KPI — same treatment |
| `updated_at` | Opportunities Won/Lost, Accepted Quotation Value | **Assumption, flagged**: neither `opportunities` nor `quotations` has a dedicated "reached terminal state" timestamp — `updated_at` is the best available proxy but is technically "last modified for any reason," not strictly "when won/lost/accepted." A real, minor imprecision inherent to the current schema. |

**Point-in-time KPIs use no date field at all** — "Active Projects" means *currently* `in_progress`, not "became in_progress within the selected range." Applying a date-range filter to these is a documented no-op (§4), never silently reinterpreted as filtering by `created_at`.

---

## 9. Financial Calculations — Database Decimal, Never JS Floats

- `opportunities.value` and `quotations.subtotal/discount/tax/total` are all Postgres `DECIMAL(14,2)` columns, mapped to `Prisma.Decimal` in the schema (confirmed by re-reading `schema.prisma`, same verification done throughout Phase 2C).
- Every aggregate (Pipeline Value, Quotation value by status, Accepted quotation value) is computed via Postgres's own `SUM()` inside the query (Prisma's `aggregate({ _sum: {...} })` or the raw-SQL equivalent) — summation happens **in the database**, not by fetching rows and adding `Decimal` values in application code. This is stricter than Phase 2C's `QuotationCalculator` (which sums `Decimal` values in JS, correctly, but only across a handful of line items already in memory for one quotation) — Dashboard aggregates could span thousands of rows across an entire tenant, so pushing `SUM()` into Postgres avoids both the performance cost and any residual doubt about JS-side decimal handling at scale.
- Any computed rate (e.g. a future "average deal size") would divide the `Decimal`/numeric result Postgres returns, never values reconstructed from JS floating-point arithmetic.

---

## 10. Performance / Caching Readiness (no Redis, no background jobs — per your instruction)

- **One service method per KPI**, not one monolithic "build the whole dashboard" method — e.g. `getTotalCustomers(companyId)`, `getPipelineValue(companyId, filters)`, `getOpenTasksByEmployee(companyId, filters)`. Each is independently callable, independently testable, and independently a future cache key (`dashboard:{companyId}:totalCustomers:{filterHash}`) without restructuring when caching is eventually added.
- Section endpoints (`/summary`, `/sales`, `/operations`, `/workload`) call the relevant subset of these methods in parallel (`Promise.all`) rather than sequentially, reducing latency without needing a cache at all for V1.
- No caching is implemented now — no Redis client, no cache decorator, no TTL logic — flagged explicitly as not built, per your instruction, not silently deferred without mention.

---

## 11. API Design (proposed — NOT implemented in this phase)

```
GET /api/v1/dashboard/summary      # Executive KPIs (Section 1)
GET /api/v1/dashboard/sales        # Sales/CRM KPIs (Section 2)
GET /api/v1/dashboard/operations   # Operations KPIs excluding workload (Section 3, minus the three workload KPIs)
GET /api/v1/dashboard/workload     # The three Employee Workload KPIs specifically (Section 3 & 7)
```

All four accept the §4 filters as query parameters (`?dateFrom=&dateTo=&departmentId=&employeeId=&customerId=&projectId=&status=&priority=`), silently having no effect on any KPI a given filter doesn't apply to (per the §4 table) rather than erroring.

---

## 12. Security

- **JWT authentication**: every Dashboard route sits behind the existing global `JwtAuthGuard` — no `@Public()` marking anywhere.
- **Tenant scope**: §5 — non-negotiable, every query.
- **RBAC**: §6 — per-section permission checks via the existing `PermissionsGuard` + `@Permissions(...)` pattern, `@InternalOnly()` on every controller.
- **Server-side filters**: §4 — filter values validated (tenant-checked where they reference another entity) before use.
- **No client-supplied companyId**: restated because it's the single most important guarantee — no Dashboard endpoint accepts a `companyId` query parameter, body field, or header.

---

## 13. Empty States

Every KPI returns a zero/empty value, never an error, when its underlying table has no matching rows for the tenant:

| Scenario | Behavior |
|---|---|
| No customers | `Total Customers: 0` |
| No leads | `New Leads: 0`, `Leads by status: []` (empty array — see note below) |
| No opportunities | `Open Opportunities: 0`, `Pipeline Value: 0.00`, `Opportunities by stage: []`, `Conversion rate: null` (not `0` — a 0/0 division has no rate, and reporting `0%` would misleadingly suggest a 100% loss rate; `null` plus a `sampleSize: 0` field lets the frontend render "not enough data" instead) |
| No projects | `Active Projects: 0`, `Completed Projects: 0`, `Projects by status: []` |
| No work orders | `Open Work Orders: 0`, `Overdue Work Orders: 0`, `Work Orders by status/priority: []` |
| No tasks | `Pending Tasks: 0`, `Completed Tasks: 0`, `Open Tasks by Employee: []` |

**Note on "by X" breakdown KPIs**: they return only buckets that actually have at least one row (`GROUP BY` naturally omits empty groups), not a zero-filled array of every possible enum value. Flagged as a decision, not an oversight — if the frontend should always receive all six lead statuses (even at `count: 0`) so it doesn't need to know the enum values itself, that's a small change (left join against a values list) and should be confirmed before implementation.

---

## 14. Accuracy — Consolidated Confirmation

Every KPI's source table, condition, date field, and calculation is documented inline in §1-3. The specific accuracy check you called out:

> Open Opportunities = `stage NOT IN ('won','lost')`. Do not reintroduce an `opportunities.status` field.

**Confirmed correct and already how it's documented above.** Re-verified directly against `schema.prisma` before writing this document: the `Opportunity` model has no `status` column at all — only `stage`, with the inline schema comment `// prospecting|qualification|proposal|negotiation|won|lost — sole state field`, the exact language from the Phase 2C correction that removed the redundant `status` column. This document does not propose reintroducing it anywhere.

---

## 15. Test Strategy (to be written when Dashboard code is implemented — not now)

**Unit tests**
- Tenant isolation: every KPI method scoped by `companyId`, proven by asserting the Prisma `where` clause includes it (same pattern as `customers.service.spec.ts`)
- RBAC: permission-metadata tests per endpoint (same pattern as `quotations.rbac.spec.ts`/`operations.rbac.spec.ts`), plus a test proving `/summary` enforces the §6 decision
- Filters: each filter's presence/absence changes the query's `where` clause as documented in §4; a filter value belonging to another tenant is rejected
- KPI calculations: each formula verified against hand-computed fixture data (e.g. seed three opportunities across two stages, assert Pipeline Value sums only the open ones)
- Date ranges: boundary conditions (a record exactly on `dateFrom`/`dateTo`, one day outside) for every date-filtered KPI in §8
- Workload aggregation: a fixture employee with both open tasks and open work orders, asserting Total Open Assignments equals the sum of the two independently-fetched counts (proving §7's no-double-count guarantee)
- Empty datasets: every §13 scenario asserted to return zero/empty rather than throw
- Cross-company filter attempts: a `customerId`/`employeeId`/`projectId` filter belonging to another tenant rejected, not silently dropped or applied

**E2E tests**
- Full `/summary`, `/sales`, `/operations`, `/workload` calls against a seeded multi-tenant fixture (Company A and Company B each with their own leads/opportunities/quotations/projects/work orders/tasks), asserting Company A's numbers never include Company B's rows
- RBAC at the HTTP level: Sales role gets 200 on `/sales`, 403 (or partial, per the §6 decision) on `/operations`; Operations role the inverse; a customer-portal login gets 403 on everything
- Filter combinations exercised through real query strings, asserting returned counts match a hand-verified fixture
- Empty-tenant case: a freshly created company with zero of everything returns the exact zero/null shapes from §13, with a 200, never a 500

---

## Report

### File created
`PHASE_2E_DASHBOARD_DESIGN.md` (this document) — documentation only. `schema.prisma` checksum and migration count (25) confirmed unchanged before writing and will be reconfirmed after.

### KPI definitions
All 27 requested KPIs (11 Executive + 8 Sales/CRM + 8 Operations, with intentional overlap such as Pipeline Value and Overdue Work Orders appearing in multiple sections) are fully specified in §1-3 with source table, filter condition, date field, and calculation — no KPI left ambiguous.

### Decisions requiring your approval
1. **§6**: `/dashboard/summary` behavior on partial permissions — proposed default is a hard 403 requiring both CRM and Operations view permissions, rather than a partial 200. Needs sign-off.
2. **§6**: The `Manager` role, as currently seeded, has no CRM/Operations view permissions and would see zero Dashboard sections under existing RBAC data — flagging that a permission-seeding addition is likely needed when Dashboard is implemented.
3. **§13**: "By status/stage/priority" breakdowns return only non-empty buckets rather than a zero-filled array covering every enum value — confirm this is the desired frontend contract.

### Assumptions discovered
1. Neither `opportunities` nor `quotations` has a dedicated "reached terminal state" timestamp — `updated_at` is used as a proxy for "when won/lost" and "when accepted." A real, minor imprecision inherent to the current schema, not resolvable without a schema change (out of scope for this phase).
2. "Conversion rate" is defined as `won / (won + lost)` — a win rate among *decided* opportunities — rather than `won / all opportunities ever created`. Both are defensible; the former was chosen because it isn't distorted by opportunities still legitimately in progress.

### Schema limitations found
One, already covered above and not requiring a fix now: the absence of terminal-state timestamps on `opportunities`/`quotations`. No other limitation was found — every other KPI has an unambiguous, directly-queryable source in the existing schema.

No Dashboard code, tables, or migrations were written. Waiting for your review of the decisions above before implementation begins.
