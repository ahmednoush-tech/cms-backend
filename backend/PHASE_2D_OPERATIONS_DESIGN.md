# Phase 2D — Operations Design Gate

**Status: documentation only.** No application code, no schema changes, no migrations were written in the preparation of this document. Every table structure referenced below was re-read directly from the approved migration files (`014`-`017`) before writing this, not recalled from memory - quoted inline where it affects a decision.

Scope: `projects`, `project_members`, `work_orders`, `tasks` - the same four tables approved in the DB design phase, unchanged.

---

## 17. Critical Design Decision (answered first, since it governs everything else)

> **Can a Project exist without an accepted Quotation?**

**Yes.** This is forced by the schema itself, not a preference: `projects.quotation_id` is declared `REFERENCES quotations(id) ON DELETE SET NULL` - nullable, no `NOT NULL`. If the intent were "every project requires a quotation," the column would be `NOT NULL`. It isn't, so the schema already encodes "quotation is optional."

**Exact enforcement rule for V1:**
- `projects.customer_id` is the only required commercial linkage (`NOT NULL` in the schema) - every project belongs to a customer, full stop.
- `projects.quotation_id` and `projects.opportunity_id` are both optional.
- **If `quotation_id` IS supplied**, the quotation's `status` must be `'accepted'` at the moment of project creation (application-level check, not a DB constraint - consistent with your instruction to use application-level validation). Creating a project from a `draft`/`sent`/`rejected`/`expired` quotation is rejected with 422.
- **If `quotation_id` is NOT supplied**, the project is a "manually created" project - allowed in V1. Examples: internal projects, warranty/goodwill work, non-sales engagements, or a project started before the paperwork catches up. This is a judgment call, not something the schema forces either way beyond "it's optional" - **flagged for your explicit approval**, since a stricter shop might want to forbid this.

This decision is the parent of Section 1 (creation rules) below.

---

## 1. Project Creation Rules

| Field | Requirement |
|---|---|
| `company_id` | Always server-derived from `AuthContext`, never client-supplied (same pattern as every CRM entity) |
| `customer_id` | **Required.** Must belong to the same company (reuses `CustomersService.assertCustomerBelongsToCompany`, same helper CRM already uses) |
| `opportunity_id` | Optional. If supplied: must belong to same company, must belong to the **same customer** as the project, must not be soft-deleted |
| `quotation_id` | Optional. If supplied: must belong to same company, must belong to the same customer, must not be soft-deleted, and **must have `status = 'accepted'`** (Section 17) |
| Cross-consistency | If **both** `opportunity_id` and `quotation_id` are supplied, the quotation's own `opportunity_id` (if it has one) must either be null or equal the project's `opportunity_id` - an inconsistent combination (quotation tied to a *different* opportunity than the one supplied) is rejected with 400 |
| `project_number` | Server-generated, unique per company - same `{PREFIX}-{year}-{4-digit sequence}` pattern and bounded-retry approach as `quotation_number` (Phase 2C), reused rather than reinvented. Proposed prefix: `PRJ-` |
| `status` | Always starts at `'planning'` (the schema default) - never client-supplied |
| `project_manager_id` | Optional at creation. If supplied, must be an **active** employee in the same company |

**Manually-created projects are allowed in V1** (Section 17). **Tenant isolation**: every one of the checks above resolves against the caller's `companyId` only - no cross-tenant reference can ever be accepted, mirroring every CRM validation pattern already shipped.

---

## 2. Project Lifecycle

Schema-approved states: `planning, approved, in_progress, on_hold, completed, cancelled`.

```
planning    -> approved, cancelled
approved    -> in_progress, cancelled
in_progress -> on_hold, completed, cancelled
on_hold     -> in_progress, cancelled
completed   -> (terminal)
cancelled   -> (terminal)
```

Enforced through the same `WorkflowTransitionValidator` used by Leads/Opportunities/Quotations - one mechanism, fourth user. Notes:
- `on_hold` is not reachable directly from `planning` or `approved` - a project must actually be `in_progress` before it can be paused. **Flagged as a judgment call**: if you want "approved" work to be put on hold before it starts, this needs an added edge.
- `completed` is only reachable from `in_progress` - you cannot mark a project `completed` while still `planning`/`approved`/`on_hold` without passing through `in_progress` first. Combined with Section 7 (completion rules), this is where "did the work actually happen" gets enforced.
- Both terminal states (`completed`, `cancelled`) have empty transition-out lists - genuinely terminal, matching the Quotation precedent.

---

## 3. Project Members

- **Employee assignment**: the assigned employee must belong to the same company as the project (`employees.company_id === project.companyId`) and must have `status = 'active'` **at the time of assignment**. A `terminated`/`inactive` employee cannot be newly added.
- **Role**: `project_members.role` is a free-text `VARCHAR(50)` in the approved schema - **no DB `CHECK` constraint restricts its values** (unlike `work_orders.priority`/`tasks.priority`, which are DB-CHECK-constrained). Recommend an application-level enum for consistency (`Project Manager`, `Coordinator`, `Technician`, `QA`, `Support` - the same set the original schema review's inline comment suggested) validated at the DTO layer, while leaving the column itself free-text per the approved schema (not proposing a schema change). **Flagged**: this is app-level only; a raw SQL insert could bypass it.
- **Duplicate membership**: `project_members` has a **composite primary key** `(project_id, employee_id)` - the database itself physically prevents the same employee being added twice to the same project. The application should translate the resulting Postgres unique-violation into 409, and the API should offer a `PATCH` (role change) as the correct way to update an existing member rather than re-`POST`ing.
- **Cross-company employee rejection**: same check as employee assignment above - 400 if the employee belongs to another company.
- **Must the Project Manager also be a Project Member?** The schema does **not** enforce this - `projects.project_manager_id` and `project_members` are independent structures. **Design decision proposed** (needs your approval): when `project_manager_id` is set (at creation or via update), automatically ensure a corresponding `project_members` row exists with `role = 'Project Manager'` (create it if missing) - so staffing views and workload queries never have to special-case the PM. If you'd rather keep them fully independent, this auto-sync step is removed and `project_manager_id` becomes purely informational.
- **Terminated/inactive employees already on a project**: not retroactively removed - `project_members` has no `deleted_at`/`status` column (same precedent as `customer_contacts`: owned entirely by its parent, no independent lifecycle), so historical membership is preserved as-is even if the employee is later terminated. Only *new* assignments are blocked.

---

## 4. Work Orders

- **Creation requirements**: `project_id` required; the referencing project must belong to the same company and must **not** be in a terminal state (`completed`/`cancelled`) - creating new work under a closed project is rejected (422).
- **Project/customer consistency**: `work_orders.customer_id` is **always server-derived from the parent project's `customer_id`** at creation - never accepted as an independent client-supplied value, even though the column technically allows any customer. (Full rationale in Section 8.)
- **Assignment**: `assigned_to_employee_id` optional; if supplied, same-company + active-status checks (Section 6). **Decision, flagged for approval**: project membership is **not** required before assigning a work order in V1 - a technician can be assigned work on a project without a formal `project_members` row. This is the simpler V1 rule; tightening it later (require membership first) is a one-line addition to the assignment check.
- **Priority**: `low | medium | high | urgent`, DB-CHECK-constrained already, defaults to `medium`.
- **Lifecycle** (schema-approved states: `new, assigned, in_progress, on_hold, completed, cancelled`):

```
new         -> assigned, cancelled
assigned    -> in_progress, cancelled
in_progress -> on_hold, completed, cancelled
on_hold     -> in_progress, cancelled
completed   -> (terminal)
cancelled   -> (terminal)
```

- **Assignment/status interaction**: the dedicated "assign" action (`assigned_to_employee_id` set via a specific endpoint, not a generic `PATCH`) auto-transitions `new -> assigned` when the work order is currently `new`. Re-assigning an already-`assigned`/`in_progress` work order changes the assignee without forcing a status change (reassignment allowed - see Section 6).

---

## 5. Tasks

- **`project_id`/`work_order_id` rule**: the schema's own `chk_task_parent` constraint already requires **at least one** of the two to be non-null - this is a DB-level guarantee, not just an app-level one.
- **Consistency when both are supplied**: if a task carries both a `work_order_id` and a `project_id`, the work order's own `project_id` must equal the task's `project_id` - a task cannot claim to belong to Project A while also claiming to belong to a work order that actually belongs to Project B. Rejected with 400 if mismatched.
- **Decision, flagged for approval**: when only `work_order_id` is supplied (no `project_id`), should the task's `project_id` be **auto-populated** from the work order's project for reporting/query convenience, or left `null`? Proposed: auto-populate it - it costs nothing, keeps "all tasks for Project X" queries simple (`WHERE project_id = X` instead of a join through work_orders), and can't ever conflict since it's derived, not client-supplied.
- **Assignment/priority**: identical rules to work orders (Section 6) - same-company + active employee, `low|medium|high|urgent` priority, default `medium`.
- **Lifecycle** (schema-approved states: `pending, in_progress, completed, cancelled` - note there is **no `on_hold` state for tasks**, unlike projects/work orders):

```
pending     -> in_progress, cancelled
in_progress -> completed, cancelled
completed   -> (terminal)
cancelled   -> (terminal)
```

---

## 6. Assignment Rules

- `assigned_to_employee_id` (on both `work_orders` and `tasks`) must reference an employee belonging to the **same company** as the record being assigned - checked via the same `assertEmployeeBelongsToCompany`-style helper Administration already established (`EmployeesService`/`DepartmentsService` precedent), reused rather than reinvented.
- The employee must have `status = 'active'` at the moment of assignment. Assigning to a `terminated`/`inactive` employee is rejected (400).
- **Project membership is NOT required before assigning work** in V1 (Section 3, Section 4 - flagged decision).
- **Reassignment after work has started is allowed** in V1 - no restriction based on current status (e.g. reassigning an `in_progress` work order to a different technician is permitted). **Flagged**: a stricter shop might want to require a reason/comment on mid-flight reassignment, or block it entirely once `in_progress`; V1 keeps it simple and unrestricted, consistent with "don't over-constrain what wasn't asked for."

---

## 7. Completion Rules

Three sub-questions, answered explicitly rather than left ambiguous:

1. **Must tasks be completed before their work order can be completed?**
   Proposed default: **yes, blocked by default.** A work order cannot transition to `completed` while it still has child tasks in `pending`/`in_progress` (422, naming the open tasks). Cancelled tasks don't block completion (a cancelled task isn't "unfinished work," it's abandoned work).

2. **Must work orders be completed before their project can be completed?**
   Same pattern: a project cannot transition to `completed` while it still has child work orders in any non-terminal state (`new`/`assigned`/`in_progress`/`on_hold`) - 422, naming the open work orders. Cancelled work orders don't block project completion.

3. **Can managers override these rules?**
   Proposed: **yes, via an explicit override**, not a silent bypass. The `complete` action accepts an optional `force: true` flag; using it requires the same permission as the action itself (`work_orders:edit` / `projects:edit` - no new permission proposed) but is logged distinctly (`action: 'completed_with_open_items'` instead of plain `'completed'`) so the audit trail shows an override happened and by whom. This satisfies "can override" without making the override invisible.

**All three of these are proposed defaults requiring your explicit approval** - the instruction was to define whether these rules exist, not to assume a specific shape for them. If you'd rather these be hard blocks with no override, that's a smaller/simpler implementation (removing the `force` flag entirely).

---

## 8. Customer Consistency

The authority chain is: `project.customer_id` is the single source of truth for "which customer is this work for." Everything else must agree with it.

- `project.customer_id` - required, set once at creation (no update path proposed for changing a project's customer after creation in V1 - moving a project to a different customer is a big enough operation it's out of scope here; flagged if you want it).
- `work_order.customer_id` - **already exists as a `NOT NULL` column in the approved schema**, separate from `project.customer_id`. You explicitly asked why: the most defensible reason is that **work orders may in some future phase reference a customer independently of their project** (e.g. subcontracted work performed for a different customer than the one who commissioned the project, or a future Supplier Portal use case) - the schema was designed to allow that flexibility even though V1 doesn't use it. **For V1, this flexibility is deliberately not exercised**: `work_order.customer_id` is always **server-derived from `project.customer_id` at creation** and never independently client-supplied, closing the gap between "the column technically allows divergence" and "V1 guarantees it never diverges." If a future phase wants work orders to genuinely serve a different customer than their project, that's a conscious V2 decision, not something that can happen by accident in V1.
- `opportunity.customer_id` / `quotation.customer_id` - already validated against each other at Quotation-creation time in Phase 2C (a quotation's `opportunity_id`, if supplied, must belong to the same customer as the quotation itself). Project creation extends the same chain: if `project.opportunity_id` and/or `project.quotation_id` are supplied, both must belong to `project.customer_id` (Section 1).

Net effect: **it is structurally impossible in V1 for a project's work order to belong to a different customer than the project itself**, and impossible for a project to be linked to an opportunity/quotation belonging to a different customer than the project declares.

---

## 9. Tenant Isolation

Every rule below is the same mechanism already proven across Administration and CRM - `companyId` resolved once from `AuthContext`, never from a client-supplied value, with cross-tenant references rejected before any write:

| Entity | Company A -> Company B behavior |
|---|---|
| Projects | 404 on read/update/delete of a Company B project; 400/404 on referencing a Company B customer/opportunity/quotation/employee at creation |
| Project Members | 400 on assigning a Company B employee to a Company A project; the project itself is tenant-scoped, so a Company A actor cannot even reach a Company B project's member list (404 upstream) |
| Work Orders | 404 on read/update/delete of a Company B work order; 400 on creating one under a Company B project (which itself would already 404 before reaching this check) |
| Tasks | Same pattern - 404 on cross-tenant read/update/delete; 400 on cross-tenant `project_id`/`work_order_id` reference |
| Assigned employees | 400 if `assigned_to_employee_id` belongs to another company (Section 6) |
| Customers / Quotations / Opportunities | Reuses the exact CRM tenant checks already shipped and tested (Phase 2C) - Operations does not reimplement these, it calls into `CustomersService`/`OpportunitiesService`/`QuotationsService`'s existing helpers the same way Quotations called into `CustomersService` |

---

## 10. Soft Delete Behavior

| Entity | Column present? | Proposed rule |
|---|---|---|
| `projects` | `deleted_at` yes | Excluded from normal queries (`deletedAt: null` filter, same as every other entity). **Proposed restriction**: only deletable while `status = 'planning'` - nothing operational has started yet. Mirrors the Quotation precedent (`draft`-only delete) for philosophical consistency across the app. **Flagged for approval.** |
| `work_orders` | `deleted_at` yes | Same exclusion pattern. **Proposed restriction**: only deletable while `status = 'new'` (nothing assigned/started) - and blocked if any child task is not `pending`/`cancelled`. **Flagged for approval.** |
| `tasks` | `deleted_at` yes | Same exclusion pattern. **Proposed restriction**: only deletable while `status = 'pending'` - a `completed` task is historical record and shouldn't disappear even via soft delete; a `cancelled` task similarly stays as a record of "this was decided against." **Flagged for approval.** |
| `project_members` | none | No independent lifecycle (Section 3) - removal from a project is a real `DELETE`, not a soft delete, same as `customer_contacts`. |
| Employees (referenced, not owned by Operations) | `deleted_at` + `status` (Administration) | An `inactive`/`terminated` employee already assigned to a project/work order/task **keeps their historical assignment** (the FK is `ON DELETE SET NULL`, only relevant on a hard delete of the employee row, which soft-delete doesn't trigger - the row persists, just flagged). Only *new* assignments to such an employee are blocked (Section 6). |

---

## 11. Audit / Activity Logs

**No schema gap here** - checked directly against `018_create_system_tables.sql` rather than assumed: `activity_logs.entity_type`'s `CHECK` constraint already includes `'project'`, `'work_order'`, and `'task'` (added when the table was originally defined, evidently anticipating Operations - unlike the `'department'` gap discovered in Administration, which remains open from Phase 2B). No follow-up migration is needed for Operations audit logging.

Proposed logged actions, reusing the exact `ActivityLogService` every prior module already writes through:

| Entity | Logged actions |
|---|---|
| Project | `created`, `updated`, `status_changed`, `deleted`, member `added`/`removed`/`role_changed` (logged under `entityType: 'project'` since `project_members` isn't its own entity in the CHECK list) |
| Work Order | `created`, `updated`, `assigned`/`reassigned`, `status_changed`, `completed` / `completed_with_open_items` (Section 7), `deleted` |
| Task | `created`, `updated`, `assigned`/`reassigned`, `status_changed`, `completed`, `deleted` |

---

## 12. Notifications (V1 triggers only - no scheduler, per your instruction)

Reusing the exact `notifications` table and creation pattern Quotations already established (Phase 2C Part 2) - a synchronous `notification.create()` call at the point of action, not a background job:

| Trigger | Notify |
|---|---|
| Work order assigned/reassigned | The newly assigned employee's linked `user` (via `employees.user_id`) - skipped if the employee has no portal/system login |
| Task assigned/reassigned | Same pattern |
| Work order marked `completed` (or `completed_with_open_items`) | The project's `project_manager_id`'s linked user, if set |
| Project status changed to `on_hold` or `cancelled` | The project's `project_manager_id`'s linked user, if set |
| Project marked `completed` | Same as above |

No scheduled/background expiry-style sweep is proposed for Operations in V1 (nothing in Operations has a time-based auto-transition analogous to Quotation expiration).

---

## 13. Permissions

Following the existing `module:resource:action` convention exactly (`Operations` as the module, matching how `Administration`/`CRM` are used today - no naming deviation needed):

```
Operations:projects:view
Operations:projects:create
Operations:projects:edit
Operations:projects:delete
Operations:projects:assign          # setting/changing project_manager_id

Operations:work_orders:view
Operations:work_orders:create
Operations:work_orders:edit
Operations:work_orders:delete
Operations:work_orders:assign       # setting/changing assigned_to_employee_id

Operations:tasks:view
Operations:tasks:create
Operations:tasks:edit
Operations:tasks:delete
Operations:tasks:assign

Operations:project_members:view
Operations:project_members:manage   # add/remove/role-change, collapsed into one action per your list
```

Matches your requested list exactly; `project_members` uses `view`/`manage` (two actions) rather than the four-action CRUD pattern, per your own naming in the request. To be seeded as data-only `INSERT`s against the existing `permissions`/`role_permissions` tables when implementation begins - same pattern as `022`/`023`/`024` (no schema change).

---

## 14. API Design (proposed - NOT implemented in this phase)

```
# Projects
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/:id
PATCH  /api/v1/projects/:id
DELETE /api/v1/projects/:id
PATCH  /api/v1/projects/:id/status
POST   /api/v1/projects/:id/assign-manager

# Project Members (nested)
POST   /api/v1/projects/:projectId/members
GET    /api/v1/projects/:projectId/members
PATCH  /api/v1/projects/:projectId/members/:employeeId    # role change
DELETE /api/v1/projects/:projectId/members/:employeeId

# Work Orders
POST   /api/v1/work-orders
GET    /api/v1/work-orders
GET    /api/v1/work-orders/:id
PATCH  /api/v1/work-orders/:id
DELETE /api/v1/work-orders/:id
PATCH  /api/v1/work-orders/:id/status
POST   /api/v1/work-orders/:id/assign

# Tasks
POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id/status
POST   /api/v1/tasks/:id/assign
```

Mirrors the exact shape already shipped for Leads (`/status` action) and Quotations (`/send`, `/accept`, `/reject` dedicated action endpoints) - no new architectural pattern introduced.

---

## 15. Dashboard Dependencies

Fields/aggregates Operations will feed once Dashboard (Phase 2F) begins - documented now so Dashboard design isn't guessing later:

- **Active Projects** - `COUNT(projects WHERE status = 'in_progress')`
- **Completed Projects** - `COUNT(projects WHERE status = 'completed')`
- **Open Work Orders** - `COUNT(work_orders WHERE status NOT IN ('completed','cancelled'))`
- **Overdue Work Orders** - `COUNT(work_orders WHERE due_date < now() AND status NOT IN ('completed','cancelled'))`
- **Pending Tasks** - `COUNT(tasks WHERE status = 'pending')`
- **Completed Tasks** - `COUNT(tasks WHERE status = 'completed')`
- **Employee Workload** - grouped `COUNT` of open `work_orders`/`tasks` by `assigned_to_employee_id`, kept as **separate** queries per your Phase 2C correction (never a single ambiguous combined count)

All of these were already anticipated in the original architecture document (Phase 2 kickoff) - this section just re-confirms they still line up with the schema as actually built.

---

## 16. Test Strategy (to be written when Operations code is implemented - not now)

Mirroring the exact structure already proven across CRM (`*.service.spec.ts` unit tests with mocked Prisma + `ActivityLogService`, plus `*.e2e-spec.ts` against a real Postgres instance):

**Unit tests**
- Tenant isolation: cross-company read/update/delete -> 404, for all four entities
- Cross-company employee assignment -> 400, for both work orders and tasks
- Project/customer consistency: opportunity/quotation belonging to a different customer than the project -> 400
- Quotation/customer consistency: non-`accepted` quotation supplied at project creation -> 422
- Workflow transitions: valid/invalid paths for all three lifecycles (project/work order/task), parametrized across every terminal-state lockout, same style as `leads.service.spec.ts`/`opportunities.service.spec.ts`
- Completion rules: work order blocked by open tasks, project blocked by open work orders, `force` override path (once Section 7 is approved)
- Soft deletes: excluded-from-query proof, status-gated deletion restriction proof, for all three entities
- Duplicate project membership: composite-PK violation -> 409
- Terminated employee restrictions: rejected on new assignment, preserved on existing historical assignment

**E2E tests**
- Full project lifecycle: `planning -> approved -> in_progress -> completed`, and a cancellation path
- Full work order lifecycle: `new -> assigned -> in_progress -> completed`, and a cancellation path
- Full task lifecycle: `pending -> in_progress -> completed`, and a cancellation path
- Cross-tenant proofs at the HTTP level for all four entities (same pattern as `phase2c-crm.e2e-spec.ts`/`phase2c-quotations.e2e-spec.ts`)
- End-to-end dependency chain: Customer -> Opportunity -> Accepted Quotation -> Project -> Work Order -> Task, created and verified in one flow
- Completion-rule enforcement at the HTTP level (422 with open children, success after clearing them, success with `force` if approved)

---

## 18. Final Dependency Chain

```
Customer
  |  (required)
  v
Opportunity --------------+  (optional)
  |  (optional)           |
  v                       |
Accepted Quotation <------+  (optional -- and if present, MUST be status='accepted')
  |  (optional)
  v
Project  (customer_id REQUIRED; opportunity_id and quotation_id OPTIONAL)
  |  (required -- a work order cannot exist without a project)
  v
Work Order  (project_id REQUIRED; customer_id auto-derived, always == project's)
  |  (a task needs project_id AND/OR work_order_id -- at least one, not necessarily both)
  v
Task
```

**What the approved schema makes optional, explicitly enumerated:**
- `project.opportunity_id` - optional
- `project.quotation_id` - optional (and per Section 17, a project can exist with **neither**)
- `task.project_id` - optional **only if** `task.work_order_id` is supplied (DB-enforced: at least one of the two)
- `task.work_order_id` - optional **only if** `task.project_id` is supplied (same DB constraint, the other direction)

**What is NOT optional:**
- `project.customer_id` - always required
- `work_order.project_id` - always required (no "standalone" work orders)
- `work_order.customer_id` - required by the schema, but per Section 8 its value is never independently chosen - it's a derived mirror of the project's customer

---

## Report

### File created
`PHASE_2D_OPERATIONS_DESIGN.md` (this document) - documentation only. No application code, schema changes, or migrations were written.

### Decisions requiring your approval (design choices, not silent assumptions)
1. **Section 17**: Manually-created projects (no quotation at all) are allowed in V1.
2. **Section 1**: If a quotation IS supplied, it must be `status = 'accepted'` - enforced at the application layer, not the DB.
3. **Section 2**: `on_hold` is only reachable from `in_progress`, not from `planning`/`approved` directly.
4. **Section 3**: Whether the Project Manager should be auto-added to `project_members` when `project_manager_id` is set (proposed: yes, auto-sync).
5. **Section 3**: `project_members.role` values constrained by an app-level enum (proposed list given) even though the DB column is free-text.
6. **Section 4 / Section 6**: Project membership is **not** required before assigning work order/task work in V1.
7. **Section 5**: A task's `project_id` is auto-populated from its `work_order_id`'s project when only the latter is supplied.
8. **Section 6**: Reassignment is allowed at any status, including `in_progress`, with no restriction.
9. **Section 7**: All three completion-gating rules (task-to-work order, work order-to-project) proposed as **default-blocked with an explicit, logged `force` override** - needs your sign-off on both the default and the override mechanism.
10. **Section 8**: `work_order.customer_id` is explained as schema-level future flexibility, deliberately not exercised in V1 (always server-derived from the project).
11. **Section 10**: Soft-delete eligibility gated by status for all three entities (`planning`-only for projects, `new`-only for work orders, `pending`-only for tasks) - mirrors the Quotation `draft`-only precedent.
12. **Section 13**: Permission naming follows your list exactly (`project_members` gets `view`/`manage` rather than four CRUD actions) - flagged only to confirm this asymmetry with the other three entities is intentional on your end too.

### Assumptions discovered while re-reading the schema
- `work_orders.customer_id` being a separate `NOT NULL` column from `project.customer_id` was not explained anywhere in the original DB design review - Section 8 supplies the most defensible rationale (future flexibility for subcontracted/cross-customer work) but this is an inference, not something documented at schema-approval time. Worth confirming that's actually why it's there, or whether it was simply a convenience/denormalization for query performance with no deeper intent.
- `project_members.role` has no `CHECK` constraint, unlike every other status/priority/type field in the schema - likely intentional (roles are more open-ended than a fixed workflow state), but flagged since it's the one enum-shaped field in Operations without DB-level enforcement.

### Schema inconsistencies found
**None requiring a fix.** One thing worth knowing: `activity_logs.entity_type`'s `CHECK` constraint already includes `'project'`, `'work_order'`, and `'task'` - confirmed by re-reading `018_create_system_tables.sql` directly rather than assuming. Unlike the open `'department'` gap from Administration (still unresolved from Phase 2B), **Operations has no audit-logging gap to fix.**

No Operations code was written. Waiting for your review of the decisions above before implementation begins.
