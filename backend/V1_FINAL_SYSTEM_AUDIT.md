# V1 Final System Audit

**Status: documentation only.** No file under `prisma/schema.prisma`, `prisma/migrations-raw/`, `src/`, `test/`, or `.github/workflows/` was modified in the preparation of this document. Baseline checksums recorded before writing: `schema.prisma` = `5fdda241d9239192bd2663ca64ab9e97`, migration count = 25, workflow checksum = `000dee61552c29e1be059928399abc49`, total `.ts` files = 122. All will be identical after this document is delivered.

**Methodology**: every claim below was checked directly against the actual files via `grep`/`find`/`view` in this session, not reconstructed from memory of prior turns. Where a claim could only be confirmed by running code (i.e. anything requiring a live PostgreSQL instance or `npm test`), it is explicitly marked STATICALLY VERIFIED vs RUNTIME VERIFIED, per your instruction not to conflate the two.

---

## 1. Database

STATICALLY VERIFIED — direct inspection of all 25 files in `prisma/migrations-raw/` and `prisma/schema.prisma`.

- **25 migrations**, sequential, no gaps: 001-019 schema (companies through indexes), 020-021 seed (roles/permissions, demo data), 022-025 data-only permission seeds for Phase 2B/2C/2C-quotations/2D respectively. No Phase 2E migration exists - confirmed deliberate: Dashboard reuses `CRM:customers:view`/`Operations:projects:view` rather than introducing a new permission resource.
- **schema.prisma consistency**: 23 models present, cross-checked field-by-field against the raw SQL for Project/ProjectMember/WorkOrder/Task/Quotation/Opportunity/Lead this session - no drift found.
- **FK integrity by inspection**: sampled work_orders/tasks FK clauses - `ON DELETE RESTRICT` on company_id/customer_id/project_id, `ON DELETE SET NULL` on assigned_to_employee_id/created_by/optional parents. Consistent throughout.
- **Unique constraints**: 9 explicit UNIQUE constraints found - users.email, (company_id, employee_number), employees.user_id, (company_id, name) on roles, (module,resource,action) on permissions, (company_id, customer_code), (customer_id, user_id) on customer_users, (company_id, quotation_number), (company_id, project_number), (company_id, work_order_number).
- **Indexes**: 019_create_indexes.sql contains 75 CREATE INDEX statements - not individually re-verified against every query pattern (would require cross-referencing every service's where/orderBy clauses; not performed).
- **Soft deletes**: confirmed present on companies, departments, users, employees, customers, customer_users, leads, opportunities, quotations, projects, work_orders, tasks. Confirmed absent (by design, documented in-file) on customer_contacts, quotation_items, project_members (owned-by-parent) and roles, permissions, user_roles, role_permissions, comments, attachments, activity_logs, notifications (reference/append-only).
- **Tenant company_id coverage**: every business table carries company_id directly except customer_contacts, quotation_items, project_members (scoped transitively through parent) and user_roles/role_permissions (scoped transitively through users/roles). Matches approved design, not a gap.
- **Polymorphic entity_type constraints**: comments/attachments CHECK-constrain to 7 values (customer, lead, opportunity, quotation, project, work_order, task); activity_logs extends to 10 (adds employee, user, role) - confirmed by direct inspection. 'department' is absent from all three lists - the one known, previously-flagged, still-open gap (see section 14).
- **customer_users isolation**: carries both company_id and customer_id independently, plus UNIQUE(customer_id, user_id).
- **Employee/user relationship**: confirmed one-directional - employees.user_id UNIQUE REFERENCES users(id); users has no employee_id column (grepped, zero matches). No circular FK.
- **Project/work_order/task relationships**: work_orders.project_id NOT NULL, work_orders.customer_id NOT NULL (deliberate denormalization, server-derived at the app layer); tasks.project_id/work_order_id both nullable with chk_task_parent CHECK requiring at least one - a genuine DB-level guarantee, not just application-level.

No schema inconsistency found beyond the already-known 'department' entity_type gap.

---

## 2. Administration

STATICALLY VERIFIED.

- **Companies**: read-only via auth context in V1, no dedicated CRUD controller (never built, never claimed to exist).
- **Departments, Employees, Users, Roles, Permissions**: full CRUD confirmed present, each tenant-scoped (companyId + deletedAt:null in every where clause, spot-checked across all five).
- **User-role assignment**: RolesService.assignRoleToUser/removeRoleFromUser confirmed, composite-key upsert/delete.
- **RBAC**: PermissionsGuard + @Permissions(...) confirmed on every controller method across all 16 controllers. @InternalOnly() confirmed present on every controller except auth.controller.ts (correct - login/refresh must be reachable pre-auth).
- **Tenant isolation**: companyId sourced exclusively via @CurrentUser('companyId'); zero instances of a companyId field on any input DTO.
- **Manager hierarchy**: EmployeesService.update() blocks managerId===id and validates same-company manager. No cycle detection (A manages B manages A) - explicitly accepted technical debt from Phase 2B, not new.
- **Soft-delete behavior**: EmployeesService.softDelete() sets both deletedAt and status:'terminated' together - consistent.
- **Duplicate user/employee linking**: assertUserAvailableForLinking() checks both in-company existence and no prior link, plus DB P2002 as a second line of defense.
- **New finding this audit**: DepartmentsService has zero ActivityLogService.record calls - this is the already-documented 'department' entity_type gap, consistently commented at every mutation point. Re-verified directly, not new.

---

## 3. Authentication

STATICALLY VERIFIED.

- **Login**: identical error for unknown-email vs wrong-password (no enumeration), bcrypt.compare, locked/inactive both rejected with 403.
- **Logout**: decodes refresh token jti/exp (without re-verifying signature) and revokes via TokenDenylistService.
- **JWT**: access token payload is the flattened AuthContext, signed at login.
- **Refresh token rotation**: confirmed real - AuthService.refresh() calls denylist.revoke() on the presented token's jti before issuing a new pair. (This was a genuine bug in an earlier draft, caught and fixed during Phase 2B verification-prep; re-confirmed fixed now.)
- **Replay protection**: RefreshJwtStrategy.validate() checks isRevoked(jti) and throws 401 if already used.
- **Known limitation**: TokenDenylistService is in-memory (Map), explicit code comment states it will not survive a restart or work across multiple instances, recommends Redis for production. Flagged prominently here (see section 16/D) since it's a real production blocker for scaled deployments.
- **Inactive/locked/deleted users**: JwtStrategy.validate() re-checks status/deletedAt from the DB on every authenticated request, not just at login.
- **Password handling**: bcrypt, 12 salt rounds.
- **/auth/me**: confirmed returns the decoded AuthContext verbatim.
- **Auth vs authz boundary**: JwtAuthGuard (global) handles authentication; PermissionsGuard/InternalOnlyGuard (per-controller) handle authorization - cleanly separated.

---

## 4. CRM

STATICALLY VERIFIED, all seven CRM entities re-inspected this session.

- **Customers**: tenant-scoped CRUD, customerCode uniqueness translated from P2002 to 409, ownerId validated same-company.
- **Customer Contacts**: scoped via re-validating the parent customer's tenant on every call (no company_id column of its own, by design).
- **Customer Users**: UNIQUE(customer_id, user_id) enforced at app and DB level; createPortalUser wraps user-creation + link in one transaction.
- **Leads / Lead conversion**: duplicate-customer matching (email then company name, both case-insensitive, tenant-scoped), idempotency (customerId||convertedAt checked before the transaction opens), entire resolve/create sequence inside one $transaction.
- **Opportunities**: stage-only state, no status column - re-confirmed directly against schema.prisma.
- **Quotations/Items**: QuotationCalculator uses Prisma.Decimal throughout, never native JS arithmetic; quotation number generation has a bounded 5-attempt retry loop.
- **Workflow transitions**: Lead/Opportunity/Quotation all route through the shared WorkflowTransitionValidator with distinct maps - one mechanism, multiple consumers.
- **Tenant isolation**: consistent companyId scoping confirmed across all seven services.
- **Customer portal isolation**: @InternalOnly() confirmed on every CRM controller - no customer-portal read endpoints exist in V1.
- **Cross-company validation**: opportunity/quotation cross-checks confirmed present.
- **Financial Decimal calculations**: confirmed Prisma.Decimal used, never JS floating point across many rows.
- **Duplicate prevention**: customerCode, quotationNumber, (customer_id,user_id), lead-conversion idempotency all confirmed.

---

## 5. Operations

STATICALLY VERIFIED, all four Operations services re-inspected this session.

- **Projects**: quotationId validated status==='accepted' + same-customer before linking; manual projects (no quotation) confirmed allowed.
- **Project Members**: composite-PK (projectId, employeeId) is the actual DB-level duplicate-prevention mechanism, with an app-level check in front for a friendlier 409; ensureMembership (PM auto-sync) confirmed idempotent.
- **Work Orders**: customerId confirmed always set from project.customerId inside the create transaction - the DTO has no customerId field at all (grepped, confirmed absent).
- **Tasks**: chk_task_parent DB constraint backed by an app-level explicit check; projectId auto-derivation from workOrderId confirmed; mismatch between explicit projectId and the work order's actual project confirmed rejected.
- **Assignment**: EmployeesService.assertActiveEmployeeInCompany (added Phase 2D, additive to Administration, confirmed not touching any CRM file) is the single shared helper used by all three assignment paths.
- **Employee validation**: same-company + active confirmed at every assignment/membership point.
- **Customer consistency**: confirmed structurally impossible for a work order to diverge from its project's customer.
- **Workflow transitions**: Project/WorkOrder/Task each have their own map in the shared validator; on_hold confirmed reachable only from in_progress (not planning/approved/new/assigned directly).
- **Completion gating**: confirmed strict, no override - zero 'force' parameters found anywhere in Operations DTOs (grepped).
- **Soft delete**: status-gated exactly as decided (planning-only, new-only, pending-only).
- **Reassignment**: confirmed unrestricted by current status in both WorkOrdersService.assign() and TasksService.assign().
- **Audit logging**: confirmed present in all four Operations services.

---

## 6. Dashboard

STATICALLY VERIFIED.

- **All 27 KPIs**: confirmed present as individual methods in DashboardService, matching the design doc 1:1 by name.
- **Source correctness**: openOpportunities/pipelineValue confirmed to query stage NOT IN ('won','lost') with no status field referenced anywhere in dashboard.service.ts (grepped).
- **Date semantics**: opportunitiesWonLost/acceptedQuotationValue confirmed filtered on updatedAt; conversionRate confirmed filtered on createdAt - the deliberate documented inconsistency, carried through exactly as decided.
- **Filters**: validateFilters() confirmed rejects cross-company customerId/projectId/employeeId/departmentId before any KPI query runs.
- **Zero-filled status buckets**: zeroFill() helper confirmed used by every breakdown KPI; bucket lists sourced via Object.keys() on the same transition-map constants every workflow validator uses.
- **Workload calculations**: buildWorkload() confirmed merges the two employee-keyed maps via plain object iteration - no SQL UNION/join in either underlying query.
- **Financial aggregation**: confirmed uses Prisma's _sum/aggregate (Postgres-side SUM()), formatted via Decimal.toFixed(2).
- **Tenant isolation**: companyId confirmed present in every KPI method's where clause (spot-checked ~10 of 27).
- **RBAC / partial permissions / unauthorized section omission**: getSummary() confirmed the omitted-not-zeroed behavior is structural (Object.assign only for authorized sections; no code path could produce a 0 for an unauthorized section).
- **Empty datasets**: every KPI method has an unconditional return path; nullish-coalescing confirmed used everywhere a _sum result could be null.

---

## 7. Security — Threat-Oriented Inspection

STATICALLY VERIFIED — this section received the most direct scrutiny this session.

| Threat | Finding |
|---|---|
| Tenant escape | No mechanism found by which one company's companyId could leak into another's query scope. companyId is set once per request, at JwtStrategy.validate(), from a re-fetched DB row — not trusted from the token alone (token AND live DB record must agree). |
| Cross-company FK injection | Every service accepting a foreign-entity ID (customerId, opportunityId, quotationId, projectId, employeeId, departmentId, workOrderId) validates that ID against the caller's companyId before use — confirmed across CRM/Operations/Dashboard. No raw client-supplied ID found reaching a where clause without a preceding company check. |
| IDOR | Every findOne/update/delete confirmed to include companyId in its own lookup where clause — a cross-tenant ID simply doesn't match any row, producing 404. |
| Unauthorized reads/writes | Gated by PermissionsGuard + @Permissions() on every route, confirmed on all inspected controllers. |
| Client-supplied companyId | Confirmed absent from every input DTO (grepped all src/modules/*/dto/*.ts — the only hits were one output DTO field and two code comments explicitly stating it's not accepted). |
| Client-supplied ownership | ownerId/projectManagerId/assignedToEmployeeId all validated against the caller's company; ownerId defaults to the authenticated actor. |
| Privilege escalation | No endpoint found allowing self-granted roles/permissions — assignment itself requires Administration:roles:manage. |
| Customer portal crossing another customer | No customer-portal read endpoints exist in V1 at all — the strongest possible mitigation. @InternalOnly() confirmed hard-blocks isCustomerUser:true independent of any permission held. |
| Soft-deleted record exposure | deletedAt:null confirmed present in every findOne/findAll where clause across every service with a deletedAt column (spot-checked ~15 services). |
| JWT refresh replay | Confirmed mitigated via the denylist, WITH the caveat that the denylist is in-memory (see section 3, section 16/D). |
| Mass assignment | Global ValidationPipe({whitelist:true, forbidNonWhitelisted:true}) confirmed in main.ts — any undeclared body field is rejected (400), not silently accepted. |
| DTO whitelist issues | One real, previously unreported bug found — see below. |

### Highlighted finding: filter query parameters likely rejected on 5 list endpoints (P1)

ProjectsController.findAll, WorkOrdersController.findAll, TasksController.findAll, OpportunitiesController.findAll, and QuotationsController.findAll all declare `@Query() query: PaginationQueryDto` — but PaginationQueryDto only declares page/pageSize/sortBy/sortDir/search. Each corresponding SERVICE method destructures additional fields (customerId, status, stage, projectId, assignedToEmployeeId, opportunityId) via `const {...} = query as any` — fields never declared on the class the controller actually typed `@Query()` as.

Given the confirmed global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})`, Nest transforms the incoming query string into a PaginationQueryDto instance before the controller body runs, and forbidNonWhitelisted means any undeclared property causes a 400 rather than being silently stripped. A request like `GET /api/v1/work-orders?status=in_progress&assignedToEmployeeId=X` would very likely be REJECTED WITH 400, not filtered — meaning the filtering functionality documented as working in the Phase 2C/2D reports for these five endpoints is, by this static reading, non-functional as shipped.

This is flagged as STATICALLY IDENTIFIED, RUNTIME UNCONFIRMED — the exact behavior depends on precise NestJS/class-transformer version behavior that needs confirmation against a running instance. But the DTO-type mismatch itself is a verified fact, not a guess.

Not affected: CustomersController/LeadsController (their services never attempt extra filter fields — pagination/search only) and the entire Dashboard module (DashboardFiltersDto fully declares every field it uses — the correct pattern).

---

## 8. API

STATICALLY VERIFIED.

- **Route consistency**: plural nouns, nested sub-resources (/customers/:id/contacts, /projects/:id/members, /quotations/:id/items), dedicated action verbs on POST /:id/{action} for state transitions rather than overloading PATCH.
- **Authentication guards**: JwtAuthGuard global (APP_GUARD), confirmed via app.module.ts.
- **RBAC guards**: PermissionsGuard/InternalOnlyGuard confirmed per-controller, not global.
- **HTTP status codes**: 400/401/403/404/409/422/500 all confirmed in active use (71/13/77/15/30/60 occurrences respectively across src/modules).
- **Validation**: class-validator decorators confirmed on every DTO inspected; global whitelist+forbidNonWhitelisted+transform pipe confirmed.
- **Error handling**: single HttpExceptionFilter confirmed as the only exception-to-response translation point.
- **Pagination**: buildMeta() confirmed shared across every paginated findAll.
- **Response consistency**: ResponseInterceptor confirmed as the single point wrapping every success response into {data, meta, errors:null}.
- **REST naming consistency**: no inconsistency found — every controller follows the same create/findAll/findOne/update/remove convention.

---

## 9. Business Workflows — Full Chain Trace

STATICALLY VERIFIED, traced link by link through the actual code.

```
Lead --(convert)--> Customer --(create)--> Opportunity --(create, accepted)--> Quotation
  --(create, quotationId optional)--> Project --(create)--> Work Order --(create)--> Task
```

- Lead to Customer: LeadsService.convert() — eligible only from qualified/proposal/won, auto-matches or creates, all in one transaction. No broken link found.
- Customer to Opportunity: requires customerId, tenant-validated. No broken link.
- Opportunity to Quotation: validates optional opportunityId belongs to same customer and isn't 'lost'. No broken link.
- Quotation to Project: validates optional quotationId is 'accepted' + same customer. No broken link, confirmed genuinely optional.
- Project to Work Order: requires projectId, blocks creation under a terminal project. No broken link.
- Work Order to Task: task can attach to work order, project, or both (validated consistent). No broken link.

**Impossible states checked**:
- A task with neither projectId nor workOrderId — blocked at both app layer (400) and DB layer (chk_task_parent). Not possible.
- A work_order with customerId different from its project's customerId — structurally impossible via the API (theoretically possible via a raw DB write bypassing the application entirely — outside the API's control by definition).
- A quotation un-accepted after being accepted — quotations are terminal once accepted, so this specific inversion cannot happen.

**New finding from this trace (P2)**: nothing prevents a single accepted quotation from being linked to MULTIPLE projects — ProjectsService.create() never checks whether a quotation is already claimed by another project, and no schema constraint prevents it either. Not previously flagged in any phase report. May be intentional (e.g. splitting one quotation across multiple projects) or may need a uniqueness check — needs a product decision, not just a fix.

**Orphan possibilities**: soft-deleting a customer does NOT cascade-block or cascade-soft-delete its leads/opportunities/quotations/projects — confirmed no such check exists in CustomersService.softDelete(). A customer can be soft-deleted while still having active projects/work orders referencing it. Consistent with the FK's ON DELETE RESTRICT (a hard delete would be blocked at the DB level), but no equivalent application-level guard exists for a soft delete. **New finding, P2** — DepartmentsService.softDelete() already blocks on active employees and ProjectsService.softDelete() is status-gated; CustomersService.softDelete() has no analogous check.

---

## 10. Audit & Notifications

STATICALLY VERIFIED.

- **Activity logs**: confirmed written by CustomersService, EmployeesService, LeadsService, OpportunitiesService, QuotationsService, ProjectsService, ProjectMembersService, WorkOrdersService, TasksService — 9 of the mutating services.
- **Mutation coverage**: create/update/delete confirmed logged in all 9.
- **Assignment logging**: confirmed for Work Orders and Tasks (assigned/reassigned) and Project Members (member_added/member_role_changed/member_removed).
- **Status transition logging**: confirmed everywhere WorkflowTransitionValidator is used.
- **Completion/cancellation logging**: distinct action values confirmed (completed, cancelled) — 'completed_with_open_items' correctly absent since no override exists in V1.
- **Not logged** (one already-known, one new): DepartmentsService (documented schema gap, section 1); CustomerContactsService and CustomerUsersService — **new finding this audit**, zero activityLog.record calls in either file, not previously called out this explicitly. Classified P2.
- **Notification triggers**: confirmed present in ProjectsService, QuotationsService, TasksService, WorkOrdersService only. Not present for Lead conversion or Customer Portal user creation — consistent with every phase's design doc, which only ever specified notifications for Quotations and Operations. Not a gap against any approved requirement.

---

## 11. Test Coverage

STATICALLY VERIFIED (inventory) — NOT RUNTIME VERIFIED (pass/fail).

19 unit spec files, 7 e2e spec files, 26 total, confirmed by direct `find`.

Unit specs: `permissions.guard.spec.ts`, `internal-only.guard.spec.ts`, `quotation-calculator.spec.ts`, `auth.service.spec.ts`, `customers.service.spec.ts` (at src/modules/crm/customers/, imports the real service — path mismatch previously flagged, still cosmetic), `dashboard.service.spec.ts`, `departments.service.spec.ts`, `employees.service.spec.ts`, `leads.service.spec.ts`, `opportunities.service.spec.ts`, `operations.rbac.spec.ts`, `project-members.service.spec.ts`, `projects.service.spec.ts`, `quotations.rbac.spec.ts`, `quotations.service.spec.ts`, `tasks.rbac.spec.ts`, `tasks.service.spec.ts`, `work-orders.rbac.spec.ts`, `work-orders.service.spec.ts`.

E2E specs: `departments-employees-isolation.e2e-spec.ts`, `phase2b-checklist.e2e-spec.ts`, `phase2c-crm.e2e-spec.ts`, `phase2c-quotations.e2e-spec.ts`, `phase2d-operations.e2e-spec.ts`, `phase2e-dashboard.e2e-spec.ts`, `security-isolation.e2e-spec.ts`.

**Missing test coverage identified this audit**:
- No `users.service.spec.ts` at all.
- No `RolesService` unit or dedicated e2e coverage at all — role/permission assignment logic is only incidentally exercised while other tests set up fixtures.
- No dedicated unit spec for `CustomerContactsService` or `CustomerUsersService` (incidental e2e coverage only, via `phase2c-crm.e2e-spec.ts`).
- No `auth.controller.spec.ts` (the controller is thin/low-risk, but untested in isolation).

**Important gap in the test suite's shape, not just its coverage**: the section 7 filter-query-parameter bug has no test that would have caught it, even on execution. Every unit test calls the service method directly with a pre-built filter object, bypassing the controller's `@Query()` DTO transformation entirely — so unit tests structurally cannot catch this class of bug regardless of whether they're ever run. Only a real HTTP-level e2e call using an actual query string would surface it, and the e2e specs written so far were not specifically written to check for an unexpected 400 on these filters, since the bug wasn't known at the time they were written.

**Whether tests were actually executed: NO, for every file listed above, across all phases from 2A through 2E.** This sandbox has never had network access or a PostgreSQL instance at any point in this project's history. No `npm install` has ever succeeded here (confirmed: `package-lock.json` still does not exist). Every test file is real, executable code, hand-traced against the service logic at time of writing — but zero executions have occurred. This audit does not change that status.

---

## 12. CI/CD

STATICALLY VERIFIED.

- **GitHub Actions**: `.github/workflows/phase2b-verification.yml` confirmed present, triggers on push/pull_request.
- **Postgres service**: postgres:16 service container confirmed, with an explicit pg_isready health-check the job waits on — not a fixed sleep.
- **Migration execution**: confirmed applies `prisma/migrations-raw/*.sql` via a glob-sorted for loop, so it correctly picks up all 25 files including ones added after the workflow's comments were originally written.
- **Seed execution**: same loop — seed files are just later-numbered .sql files in the same directory, no separate seed step needed.
- **Unit tests**: `npm test -- --coverage` confirmed, output piped via `tee`, with `set -o pipefail` explicitly added so a failure actually fails the step.
- **E2E tests**: `npm run test:e2e` confirmed, same pipefail treatment. Automatically picks up all 7 e2e files via Jest's glob — no workflow edit was ever needed when new e2e files were added.
- **Coverage**: `--coverage` flag confirmed; a `coverage-report` artifact upload step confirmed present.
- **Artifacts**: three `actions/upload-artifact@v4` steps confirmed (unit-test-log, e2e-test-log, coverage-report), all `if: always()`.
- **Failure behavior**: `set -o pipefail` on both test steps confirmed; no `continue-on-error` or similar suppression found anywhere.

**Documentation drift found in this file (P3, cosmetic)**: the workflow's own name ("Phase 2B Verification") and inline comments ("Apply approved database migrations (001-019) and seed data (020-022)", and a header referencing only `phase2b-checklist.e2e-spec.ts`) are stale — written when only 22 migrations and 3 e2e files existed. The workflow FUNCTIONALLY still correctly picks up all 25 migrations and all 7 e2e files (both via glob, not an enumerated list) — nothing is functionally broken, but a developer reading the workflow's self-description today would get an inaccurate picture of its actual scope.

**This workflow has never been triggered** — no GitHub repository has been connected at any point in this project's conversation history — so despite being well-constructed by static reading, it has produced zero actual runtime evidence to date.

---

## 13. Code Quality

STATICALLY VERIFIED.

- **Duplicated logic**: number-generation (quotation/project/work-order) is structurally identical across three services (same bounded-retry pattern) but implemented three separate times rather than factored into a shared helper. P3 — works correctly, just not DRY.
- **Inconsistent patterns**: `findAll` methods across Opportunities/Quotations/Projects/WorkOrders/Tasks all use `query as any` to read extra filter fields not declared on the typed parameter — a code-quality smell AND the root cause of the P1 bug in section 7. One fix (proper extended DTOs, mirroring DashboardFiltersDto) resolves both simultaneously.
- **Dead code**: none found in this pass.
- **Unsafe `any`**: 5 confirmed instances, all the same `query as any` pattern — not scattered elsewhere.
- **Missing error handling**: `ActivityLogService.record()` confirmed wrapped in try/catch internally (an audit-log failure never blocks the underlying business operation) — correct defensive design, not a gap.
- **Inconsistent naming**: none found — camelCase fields/methods, PascalCase classes, kebab-case files, all consistent across all 122 files.
- **Architectural violations**: none found — every module respects controller-to-service-to-prisma layering; no controller found calling prisma directly.
- **Circular dependencies**: full module import graph checked this session (Tasks to Projects/WorkOrders/Employees; WorkOrders to Projects/Employees; Projects to Customers/Employees; Dashboard to Customers/Projects) — acyclic, confirmed.
- **Modules bypassing shared security patterns**: none found — every controller uses the same InternalOnlyGuard/PermissionsGuard/@CurrentUser triad; no controller reads req.user directly.

---

## 14. Documentation Consistency

STATICALLY VERIFIED, cross-referencing direct file inspection against what each phase's README/report claimed.

| Area | Documented | Actual | Drift? |
|---|---|---|---|
| Migration count | 25 | 25 | None |
| 'department' audit-log gap | Flagged since Phase 2B, still open | Confirmed still open, unchanged | None — consistently tracked |
| Manager role Dashboard visibility | Flagged in Phase 2E design as seeing nothing | Confirmed — Manager's Phase 2B seed grants zero CRM/Operations view permissions | None |
| CI workflow scope | README describes it as covering the full suite | Workflow's own name/comments say "Phase 2B" and reference only 22 migrations / one e2e file | Drift found (section 12) — README is accurate, the workflow file's self-description is stale |
| Filter query params on 5 endpoints | Described as working, filterable | DTO type mismatch strongly suggests they reject those very filters | Drift found (section 7/13) — the most significant finding of this audit |
| customer_contacts/customer_users activity logging | Never explicitly addressed either way | Confirmed absent | Gap in documentation, not misstatement — simply never discussed |
| Quotation-to-multiple-projects | Never addressed | No constraint prevents it | Gap in documentation — an implicit one-to-one assumption was never stated or enforced |
| Customer soft-delete cascade | Never addressed | No downstream-record check exists | Gap in documentation, same category |

**Overall assessment**: no case was found where documentation actively claimed something false about security or data integrity. The drift found is concentrated in one real functional bug (filters) that documentation optimistically assumed worked, plus a handful of edge cases that were simply never discussed either way in any prior phase — silence, not misstatement.

---

## 15. Findings, Classified

### P0 — Security / Data-loss / Blocking
None found. No tenant-isolation bypass, no authentication bypass, no mass-assignment vulnerability, no unbounded data exposure was found anywhere in this inspection.

### P1 — Production-critical
1. Filter query parameters on 5 list endpoints (Projects, Work Orders, Tasks, Opportunities, Quotations) likely rejected outright (400) rather than filtering, due to a DTO type mismatch between the controller's `@Query()` typing and what the service attempts to read, combined with the global whitelist+forbidNonWhitelisted pipe. STATICALLY IDENTIFIED, RUNTIME UNCONFIRMED.
2. `TokenDenylistService` is in-memory — refresh-token revocation does not survive a restart and does not work across more than one backend instance. Fine for this single-instance development context; a real blocker for any horizontally-scaled or auto-restarting production deployment.

### P2 — Important improvement
1. `CustomerContactsService`/`CustomerUsersService` write no activity-log entries, inconsistent with every other CRM/Operations service.
2. No check prevents an accepted quotation from being linked to more than one project — may be intentional, needs a product decision.
3. `CustomersService.softDelete()` has no downstream-active-record check, unlike Departments'/Projects' equivalents.
4. No `RolesService` unit tests exist at all.
5. No `UsersService`, `CustomerContactsService`, or `CustomerUsersService` unit tests exist.
6. `'department'` remains absent from `activity_logs.entity_type`'s CHECK list — carried forward from Phase 2B, still unresolved, your call pending.

### P3 — Cosmetic / future
1. CI workflow's name and inline comments are stale, though the workflow functions correctly via glob patterns regardless.
2. Number-generation logic duplicated three times rather than factored into a shared service.
3. `customers.service.spec.ts` lives at a path that doesn't match the actual service's real location — cosmetic, imports resolve correctly, previously flagged and accepted.
4. No `package-lock.json` committed — `npm install` used instead of `npm ci` in CI.

---

## 16. Final Verdict

# NOT READY

**Rationale**: not because of any P0 finding — there are none. This codebase has never been executed even once. Every claim of correctness in this audit and in every phase report before it is a static-inspection claim, not a runtime-verified one. A system carrying a likely-real P1 functional bug (section 7) that has never been run cannot be called ready for any environment, including internal QA, until it has actually executed successfully at least once against a real database.

This is not a statement that the code is bad — the tenant-isolation discipline and RBAC consistency found across 122 files and 25 migrations in this audit are unusually thorough for a project at this stage. It is a statement that static inspection, however careful, is not a substitute for the codebase compiling and its test suite passing even once, and that has not yet happened.

---

## A. Critical Findings
- The section 7/13 filter-query-parameter bug (P1) is the single most important finding — it directly contradicts documented behavior across five modules and was only discoverable by reading the controller and DTO files side by side, which no prior phase report did.
- No P0 (security/data-loss) finding exists anywhere in the codebase, based on a genuinely adversarial read of tenant isolation, IDOR, mass-assignment, and privilege-escalation surfaces.
- The in-memory `TokenDenylistService` (P1) is a known, self-documented limitation, not a surprise — but it has never before been explicitly named a production blocker in a report's top-level findings.

## B. Recommended Fixes
1. Declare proper extended filter DTOs (mirroring `DashboardFiltersDto`) for Projects/WorkOrders/Tasks/Opportunities/Quotations `findAll` query parameters — resolves both the P1 bug and the `as any` code-quality issue in one change.
2. Replace `TokenDenylistService`'s in-memory Map with a Redis-backed implementation before any multi-instance or restart-prone deployment.
3. Add activity logging to `CustomerContactsService`/`CustomerUsersService`.
4. Decide (product decision) whether a quotation should be restricted to one project, and whether `CustomersService.softDelete()` should block on active downstream records.
5. Refresh the CI workflow's name/comments to reflect its actual current scope.
6. Fill the identified unit-test gaps (RolesService, UsersService, CustomerContactsService, CustomerUsersService).

## C. Tests Still Requiring Execution
All of them. All 19 unit spec files and all 7 e2e spec files, across every phase from 2A through 2E, have never been executed. This is unchanged by this audit and remains the single largest open item for this project — the GitHub Actions path is already built and waiting (section 12).

## D. Production Readiness Blockers
1. Zero runtime test execution to date — blocks everything.
2. The P1 filter-parameter bug, if confirmed on execution, blocks any feature relying on list filtering.
3. The in-memory token denylist blocks any horizontally-scaled or auto-restarting production deployment.
4. No frontend exists yet — explicitly out of scope for every phase so far, restated here as a completion blocker, not a defect.

## E. V1 Completion Score

**Backend feature completeness (against the originally scoped V1 modules): approximately 90%.** Administration, CRM, Operations, and Dashboard are all functionally implemented per their respective approved designs. The remaining ~10% is the System module (Comments/Attachments/Activity Logs/Notifications *read* endpoints — the data is being written throughout, just not yet exposed for reading) and the two P1 fixes above.

**Verified-working completeness (proven by actual execution): 0%.** This is the number that matters most for the verdict in section 16 — feature completeness and verified correctness are different numbers, and conflating them would misrepresent the system's actual readiness.

## F. Exact Next Action

**Connect a repository to GitHub and let `.github/workflows/phase2b-verification.yml` run.** This single action would: (1) install dependencies for the first time ever in this project's history, (2) apply all 25 migrations against a real Postgres instance for the first time, (3) execute all 26 test files for the first time, and (4) either confirm or refute the P1 filter-parameter finding within minutes. Every other recommendation in this audit is secondary to obtaining that first real execution result.
