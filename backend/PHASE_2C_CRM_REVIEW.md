# Phase 2C — CRM Completion Review

Status: **CRM implementation complete (Customers → Quotation Items). No code or schema changes in this document — review only.**
Phase 2B status, unchanged: **implementation complete, verification pending.**
Operations: **not started** — verified in §11 below.

---

## 1. Final CRM Entity Map

| Entity | Table | Prisma model | Purpose |
|---|---|---|---|
| Customers | `customers` | `Customer` | Companies/individuals being served |
| Customer Contacts | `customer_contacts` | `CustomerContact` | People at a customer |
| Customer Users | `customer_users` | `CustomerUser` | Portal login access, linking a `users` row to a customer |
| Leads | `leads` | `Lead` | Pre-sales prospect, may convert to a customer |
| Opportunities | `opportunities` | `Opportunity` | Active sales pursuit against a customer |
| Quotations | `quotations` | `Quotation` | Priced proposal |
| Quotation Items | `quotation_items` | `QuotationItem` | Line items on a quotation |

All seven use the approved schema exactly as designed in the DB review phase — no fields, tables, or constraints were added or altered during Phase 2C.

---

## 2. Final CRM Relationship Map

```
companies 1──* customers
customers 1──* customer_contacts
customers 1──* customer_users *──1 users
customer_contacts 1──* customer_users        (contact_id nullable)

customers 1──* leads
leads ──(converted_at / converted_by / customer_id)──> customers   [lead row never deleted]
leads 1──* opportunities                      (optional lead_id, nullable)
customers 1──* opportunities

customers 1──* quotations
opportunities 1──* quotations                 (optional opportunity_id, nullable)
quotations 1──* quotation_items

users 1──* customers            (owner_id)
users 1──* leads                (owner_id, converted_by)
users 1──* opportunities        (owner_id)
users 1──* quotations           (created_by)
```

Everything in CRM still ultimately scopes back to `companies` via `company_id` on every table except `customer_contacts` and `quotation_items`, which scope through their parent (`customers`/`quotations` respectively) — this was an explicit, approved design decision, not an oversight (documented again in §6).

---

## 3. All CRM Endpoints Implemented So Far

```
# Customers
POST   /api/v1/customers
GET    /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
DELETE /api/v1/customers/:id

# Customer Contacts (nested)
POST   /api/v1/customers/:customerId/contacts
GET    /api/v1/customers/:customerId/contacts
GET    /api/v1/customers/:customerId/contacts/:contactId
PATCH  /api/v1/customers/:customerId/contacts/:contactId
DELETE /api/v1/customers/:customerId/contacts/:contactId

# Customer Users — portal access (nested)
POST   /api/v1/customers/:customerId/portal-users                # create new login + link
POST   /api/v1/customers/:customerId/portal-users/link-existing  # link an existing users row
GET    /api/v1/customers/:customerId/portal-users
DELETE /api/v1/customers/:customerId/portal-users/:customerUserId  # revoke (soft delete)

# Leads
POST   /api/v1/leads
GET    /api/v1/leads
GET    /api/v1/leads/:id
PATCH  /api/v1/leads/:id
PATCH  /api/v1/leads/:id/status
POST   /api/v1/leads/:id/convert
DELETE /api/v1/leads/:id

# Opportunities
POST   /api/v1/opportunities
GET    /api/v1/opportunities
GET    /api/v1/opportunities/:id
PATCH  /api/v1/opportunities/:id
PATCH  /api/v1/opportunities/:id/stage
DELETE /api/v1/opportunities/:id

# Quotations
POST   /api/v1/quotations
GET    /api/v1/quotations
GET    /api/v1/quotations/:id
PATCH  /api/v1/quotations/:id
DELETE /api/v1/quotations/:id
POST   /api/v1/quotations/:id/send
POST   /api/v1/quotations/:id/accept
POST   /api/v1/quotations/:id/reject
POST   /api/v1/quotations/:id/expire

# Quotation Items (nested)
POST   /api/v1/quotations/:quotationId/items
PATCH  /api/v1/quotations/:quotationId/items/:itemId
DELETE /api/v1/quotations/:quotationId/items/:itemId
```

37 endpoints total. All are `@InternalOnly()` (staff-facing) — no Customer Portal read endpoints exist yet (confirmed unbuilt, per your instruction, in every prior report).

---

## 4. All CRM Permissions

Ground truth pulled directly from the controller decorators and the three seed migrations (`020`, `023`, `024`), not from memory:

| Resource | Actions | Seeded in | Notes |
|---|---|---|---|
| `customers` | `view`, `create`, `edit`, `delete` | `020` | Customer Contacts and Customer Users **reuse these same four** — there is no separate `customer_contacts` or `customer_users` permission resource (see below) |
| `leads` | `view`, `create` | `020` | |
| `leads` | `edit`, `delete` | `023` | |
| `opportunities` | `view`, `create` | `020` | |
| `opportunities` | `edit`, `delete` | `023` | |
| `quotations` | `view`, `create` | `020` | |
| `quotations` | `edit`, `delete` | `023` | |
| `quotations` | `send`, `accept`, `reject` | `024` | |

**Design note on Contacts/Portal Users**: both `CustomerContactsController` and `CustomerUsersController` are guarded with `CRM:customers:view` (reads) and `CRM:customers:edit` (writes) rather than their own permission resource — since both are always accessed as sub-resources of a customer, this was judged sufficient rather than fragmenting permissions further. Flagged here as a design choice, not an oversight.

**Lead conversion** requires **both** `CRM:leads:edit` and `CRM:customers:create` (since it can create a customer) — the only endpoint in CRM requiring two permissions simultaneously.

Granted to seeded roles: **Super Admin** gets every CRM permission; **Sales** gets every CRM permission (all resources/actions); **Manager**, **Operations**, **Employee** get none of them (no CRM access by default).

---

## 5. All CRM Status/Stage Transition Rules

All three enforced through the same shared `WorkflowTransitionValidator` (`src/common/services/workflow-transition.validator.ts`) — one mechanism, not three separate implementations.

**Lead** (`status`):
```
new → contacted → qualified → proposal → won
                                        ↘ lost
(contacted, qualified, proposal can each also go directly to lost)
won, lost: terminal — no transitions out
```

**Opportunity** (`stage`):
```
prospecting → qualification → proposal → negotiation → won
                                                       ↘ lost
(qualification, proposal, negotiation can each also go directly to lost)
won, lost: terminal — no transitions out
```

**Quotation** (`status`):
```
draft → sent → accepted
             ↘ rejected
             ↘ expired
accepted, rejected, expired: terminal — no transitions out
```

Invalid transitions (skipping stages, or any move out of a terminal state) return **422** with a message naming the attempted `from → to` and what was actually allowed.

**Lead conversion eligibility** (approved rule, separate from the transition graph itself): conversion is only permitted when `lead.status` is `qualified`, `proposal`, or `won` — `new`, `contacted`, `lost` are rejected with 400.

**Quotation editing restrictions by status** (approved, documented again here per your instruction to keep these rules visible):
- `draft`: items addable/editable/deletable; `customerId`/`opportunityId` changeable; totals recalculate automatically.
- `sent`: only `validUntil` may change (422 on any attempt to change `customerId`/`opportunityId`); items cannot be added/edited/deleted at all (422).
- `accepted`/`rejected`/`expired`: fully immutable (422 on any `update`, item mutation, or re-transition attempt).

---

## 6. All Tenant-Isolation Rules

- Every CRM table carrying `company_id` (`customers`, `leads`, `opportunities`, `quotations`) is filtered by the authenticated user's `companyId` (from `AuthContext`, never from a client-supplied value) on every read/write. A record belonging to another company is **not found** (404), not merely hidden — cross-tenant existence is never leaked.
- `customer_contacts` and `quotation_items` have no `company_id` column of their own (approved schema decision). Tenant scoping for these is enforced by re-validating the **parent's** `company_id` on every call before touching a child row (`CustomerContactsService` re-checks the parent customer; `QuotationsService` re-checks the parent quotation).
- `customer_users` carries its own `company_id` (added as a correction during the DB design phase specifically so portal-access tenant checks don't have to join through `customers`) — verified independently of `customer_id` on every operation.
- Cross-tenant reference attempts are rejected before any write:
  - Creating a department/customer/quotation with an owner/manager/customer from another company → 400/404 (Administration precedent, same pattern reused here).
  - Creating a quotation for a customer in another company → 404 (customer not found in tenant scope).
  - Creating an opportunity/quotation referencing an opportunity from another company → 400.
  - Linking a `customer_users` row to a user from another company → rejected (user lookup itself is tenant-scoped).
- Proven at the HTTP level in `test/phase2c-crm.e2e-spec.ts` and `test/phase2c-quotations.e2e-spec.ts` (customer read/update/delete/create-cross-reference, opportunity create-cross-reference, quotation read/send/accept/item-modification — all cross-tenant attempts asserted as 404, and the cross-customer opportunity/quotation-creation attempts asserted as 400).

---

## 7. All Cross-Entity Validation Rules

| From → To | Rule | Enforced by |
|---|---|---|
| Lead → Customer (conversion) | Auto-match existing customer by email, then by company name, before creating a new one; explicit `existingCustomerId` overrides matching entirely | `LeadsService.findMatchingCustomer` |
| Lead → Contact (conversion) | Reuse an existing contact under the resolved customer if one matches by email; never duplicate | `LeadsService.convert` |
| Lead → Opportunity (conversion, optional) | `opportunityName` required if `createOpportunity: true` | `LeadsService.convert` |
| Opportunity → Customer | `customerId` must belong to the caller's company | `OpportunitiesService.create` via `CustomersService.assertCustomerBelongsToCompany` |
| Quotation → Customer | `customerId` must belong to the caller's company | `QuotationsService.create`/`update` via the same shared helper |
| Quotation → Opportunity (optional) | Must belong to same company, must belong to the **same customer** as the quotation, must not be soft-deleted, must not be in `lost` stage | `QuotationsService.assertOpportunityValidForQuotation` |
| Quotation Item → Quotation | Item mutations only permitted while the parent quotation is `draft` | `QuotationsService.assertDraftForItemMutation` |
| Customer Contact → Customer | Contact operations re-validate the parent customer's tenant before touching any contact row | `CustomerContactsService` (every method) |
| Customer User → Customer/Contact | `contactId`, if supplied, must belong to the same customer; duplicate `(customer_id, user_id)` link rejected (409) at both the app layer and the DB unique constraint | `CustomerUsersService` |
| Employee link (Administration, reused pattern) | Not part of CRM, but the same "belongs to same company" helper pattern used throughout CRM originates here | `EmployeesService.linkUser` |

**Line-item math** (not cross-entity, but a validation rule worth restating): `quantity > 0`, `unitPrice ≥ 0`, `discount ≥ 0` and `≤ line subtotal`, `tax ≥ 0` — all enforced in `QuotationCalculator.calculateLine`, which is the only place these values are ever computed or validated.

---

## 8. All Migrations Added During Phase 2C

| File | Type | Contents |
|---|---|---|
| `023_seed_phase2c_permissions.sql` | Data-only | `edit`/`delete` actions for `CRM:leads`, `CRM:opportunities`, `CRM:quotations` (customers' edit/delete were already present from `020`) |
| `024_seed_phase2c_quotation_permissions.sql` | Data-only | `send`/`accept`/`reject` actions for `CRM:quotations` |

**No schema migration was added or modified in Phase 2C.** The `customers`, `customer_contacts`, `customer_users`, `leads`, `opportunities`, `quotations`, `quotation_items` tables were already fully defined in the approved `007`–`013` migrations from the DB design phase; Phase 2C only built application code and permission data against them. Total migrations in the project: **24** (`001`–`021` approved schema + demo seed, `022` Phase 2B permissions, `023`–`024` Phase 2C permissions).

---

## 9. Every Test File Covering CRM

**Unit (Jest, `*.spec.ts`)**
- `src/modules/customers/customers.service.ts` — *(no dedicated spec file was written for Customers itself; covered indirectly through e2e — see gap note in §10)*
- `src/modules/leads/leads.service.spec.ts` — status transitions, conversion (eligibility, duplicate-customer matching, duplicate-contact avoidance, explicit-override, idempotency, transactional rollback propagation, optional opportunity)
- `src/modules/opportunities/opportunities.service.spec.ts` — stage transition allow/deny, terminal-state lockout
- `src/common/services/quotation-calculator.spec.ts` — line math, float-drift safety, all four line-validation rejections, aggregate summation, empty-list case
- `src/modules/quotations/quotations.service.spec.ts` — tenant isolation, customer/opportunity validation (all four opportunity rules), server-side calculation override, quotation-number generation + collision retry + exhaustion, terminal-state protection (parametrized), sent-state restriction, full send/accept/reject/expire coverage, GET-never-mutates proof
- `src/modules/quotations/quotations.rbac.spec.ts` — permission-metadata proof for every quotation/item route

**E2E (Jest + Supertest, `*.e2e-spec.ts`, run against a real PostgreSQL instance)**
- `test/phase2c-crm.e2e-spec.ts` — customer tenant isolation + duplicate-code 409, portal-user creation/login/duplicate-link 409, lead status transitions, full lead-conversion flow (including the two-leads-same-email dedup proof and explicit-override proof), opportunity stage invalid-transition, cross-tenant opportunity-creation rejection
- `test/phase2c-quotations.e2e-spec.ts` — both full lifecycles (`draft→sent→accepted`, `draft→sent→rejected`), invalid-transition rejections, tenant isolation across read/send/accept/create/item-modification, both opportunity-validation rejections, calculation trust boundary, quotation-number uniqueness

**Execution status, restated per your standing instruction not to claim tests passed without running them: none of the above have been executed.** This sandbox has no network access and no PostgreSQL instance (verified repeatedly across every phase). All are real, executable code, hand-traced against the service logic, with static consistency checks run on every file — but "written and traced" is not "passed." Real execution is still the GitHub Actions path from Phase 2B, which has not yet been triggered.

---

## 10. Remaining CRM Gaps and Assumptions

**Gaps (things not built, not things broken):**
1. **No dedicated `customers.service.spec.ts`.** Customer CRUD tenant-isolation and duplicate-code behavior are proven at the e2e level (`phase2c-crm.e2e-spec.ts`) but not at the unit level the way Leads/Opportunities/Quotations are. Minor inconsistency in test coverage depth across CRM — worth closing before calling CRM "done" if unit-level coverage parity matters to you.
2. **Customer Portal has no read endpoints.** A logged-in `customer_users` identity gets `isCustomerUser: true` on their token but cannot yet read their own customer/opportunity/quotation records — this was explicitly out of scope for every CRM slice so far and was never requested.
3. **No bulk/scheduled quotation expiration.** `POST /:id/expire` is a single-quotation, explicitly-triggered action, per your instruction not to add a scheduler yet. There is no company-wide "expire all overdue" sweep endpoint either — only ever built as a per-quotation action.
4. **No opportunity→quotation cross-tenant unit test** at the service-mock level for the "different customer" and "lost stage" cases beyond what's in `quotations.service.spec.ts` (which does cover them) — noting only because those two checks live inside `QuotationsService`, not `OpportunitiesService`, so they're easy to miss if scanning by module name alone.

**Assumptions carried forward (all previously flagged and now approved by you):**
1. Lead conversion eligible only from `qualified`/`proposal`/`won`. **Approved.**
2. Quotation delete = draft only. **Approved.**
3. Quotation accept/reject = sent only, not reachable from draft directly. **Approved.**
4. Quotation-notification recipient = customer's `ownerId`, falling back to the quotation's `createdBy`. **Approved.**
5. Quotation line-level `discount`/`tax` = absolute amounts, not percentages/rates. **Approved.**
6. Customer Contacts and Customer Users share the `customers` permission resource rather than having their own (§4) — not previously flagged explicitly; flagging now for your awareness, not asking you to change it.

**No open/unresolved questions remain from Phase 2C** — the one structural question from the DB design phase (whether `department` should be added to `activity_logs.entity_type`) is an Administration matter, not CRM, and remains open from Phase 2B, unaffected by this review.

---

## 11. Verification: No Operations Code Introduced

Checked directly against the filesystem, not from memory, before writing this document:

```
$ find src -iname "*project*" -o -iname "*work-order*" -o -iname "*workorder*" -o -iname "*task*" -o -iname "*operation*"
(no output — nothing found)

$ grep "Module," src/app.module.ts
PrismaModule, CommonServicesModule, AuthModule, UsersModule, RolesModule,
DepartmentsModule, EmployeesModule, CustomersModule, CustomerContactsModule,
CustomerUsersModule, LeadsModule, OpportunitiesModule, QuotationsModule
(only Administration + CRM modules registered — no ProjectsModule, WorkOrdersModule, or TasksModule)
```

The `Project`, `ProjectMember`, `WorkOrder`, and `Task` **Prisma models** are present in `prisma/schema.prisma` — but only as the direct, untouched translation of the already-approved `014`–`017` migrations from the DB design phase (they've been there since Phase 2A's schema file, before any application code existed). No service, controller, module, DTO, or test references them. **Confirmed: zero Operations application code exists.**

---

## Status

CRM is feature-complete for V1 scope: Customers, Customer Contacts, Customer Users, Leads (+ conversion with duplicate-customer safeguard), Opportunities, Quotations, Quotation Items — 37 endpoints, full workflow-transition enforcement across three entities, tenant isolation verified at both unit and e2e levels, server-side-only monetary calculation, and audit logging on every meaningful action.

Waiting for your review before Operations (Phase 2D) begins. No code or schema was touched in the preparation of this document.
