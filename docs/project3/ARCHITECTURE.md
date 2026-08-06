# Project 3 Architecture

## V2-11 closure review

The V2-11 review reconfirmed server-side ownership, exact-capability, and
private no-store boundaries through the preserved regression suite, source
review, and completed authenticated Chromium coverage. The earlier browser-only
Prisma `EACCES` condition was a sandbox process-network restriction rather than
a database schema or grant defect; approved elevated Chromium execution passed
the remaining V2-5 through V2-10 coverage. No database mutation or production
environment access occurred, and V2-12 was not started.

## Purpose

Document stable system boundaries and security invariants without duplicating implementation detail or the Prisma schema. Workflow decisions are in [DECISIONS.md](DECISIONS.md); verification expectations are in [VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md).

## System context

The SIST Portal is an institutional Next.js application serving student and staff workflows over PostgreSQL through server-only data access. Exact routes, components, integrations, and deployed topology not verified by CTRL-001 remain `UNVERIFIED`.

## Main actors

- `STUDENT`: accesses only authorized personal student services and records.
- `STAFF`: performs only operations granted by database-authoritative capabilities.

## Trust boundaries

### Student boundary

Student identity is established server-side. Ownership is enforced on every protected record query or mutation; another student's records and staff operations remain inaccessible.

### Staff boundary

Staff access requires a valid actor, active account, valid session state, eligible role, and the required database capability. Zero-capability staff accounts remain safe.

### Administrative request boundary

Administrative requests must validate actor authority, request state, input, ownership where applicable, transactional behavior, and required audit creation.

### Notification boundary

Notifications minimize sensitive content and validate recipients on the server.
Owned in-portal records are authoritative for presentation. Student email
delivery is provider-neutral and starts from a transactional outbox with stable
idempotency keys, processing leases, five bounded retries, and normalized
provider results. Provider failure does not roll back an already committed
domain event. Live provider configuration is server-only and fails closed.

### Audit presentation boundary

Audit history is append-only and remains distinct from user notifications.
Only an active current STAFF actor with `VIEW_AUDIT_LOG` can read the audit
viewer. The viewer is read-only, bounded, deterministically ordered, filterable,
and maps metadata through an explicit display allowlist rather than rendering
raw JSON.

### Import trust boundary

Registry and finance uploads are untrusted input. V2-8 implements only registry
imports; finance imports remain outside the boundary. Upload and approval use
the distinct `REGISTRY_IMPORT_UPLOAD` and `REGISTRY_IMPORT_APPROVE`
capabilities, and the uploader cannot review the same batch.

The server accepts only bounded UTF-8 CSV or OOXML XLSX input. A fixed template,
strict MIME and extension agreement, a 5 MiB upload limit, a 5,000-row limit,
one-worksheet enforcement, ZIP-entry and expanded-size bounds, and rejection of
formulas, macros, external links, encryption, unsafe archive paths, and malformed
content apply before staging. Raw upload bytes are discarded after a SHA-256
checksum is calculated; only normalized rows, field errors, safe metadata, and
the checksum are persisted.

Registry batches follow `UPLOADED -> VALIDATED -> PENDING_APPROVAL ->
APPROVED` or terminal `REJECTED` transitions. Only valid batches may be
submitted. Approval revalidates the actor, batch, rows, exact caps, and allowed
student-registry field changes inside one serialized transaction. Advisory and
row locks prevent duplicate or conflicting execution; the registry writes and
required sanitized audit record succeed or roll back together. Approved
records are retained, while expired non-approved staging is purged through a
bounded idempotent operation.

### Document and private-storage boundary

V2-9 stores PDF artifacts through a server-only, provider-neutral
`DocumentStorage` interface. The production adapter uses private Vercel Blob
objects; a deterministic in-memory adapter is available only through explicit
non-production test configuration and fails closed on Vercel. PostgreSQL stores
opaque object keys and integrity metadata, never PDF bytes or provider URLs.

The initial trusted server-only template is
`REQUEST_FULFILMENT_CONFIRMATION`. Artifacts are immutable versions with
`GENERATED`, `RELEASED`, `REVOKED`, and `SUPERSEDED` states. Request and
artifact locks serialize version allocation, release supersession, and
release/revoke races. Required audit and notification records share the
lifecycle transaction. A database failure after upload triggers provider
compensation; bounded age-gated cleanup removes only unreferenced orphans.

Staff operations revalidate their exact database capability. Student metadata
and download access require an active current student, request ownership,
digital delivery, and a released artifact. Downloads pass through authenticated
application routes with private no-store headers; provider URLs and object keys
never cross the server boundary.

### Finance boundary

Finance data is private. Viewing, upload, approval, and export require their distinct capabilities and appropriate transaction and audit controls.

V2-10 adds immutable posted transactions, student-owned statements, capability-protected staff reads and exports, and controlled finance-import staging. Staff detail routes use the database-authoritative `StudentProfile.id` emitted by Finance search results; denied, malformed, and nonexistent identifiers remain non-enumerating.

## Application layers

- Next.js App Router presentation and routing
- Server Components by default; Client Components only for genuine interactivity
- Trusted server mutation and authorization boundaries
- Server-only business and database modules
- Prisma persistence over PostgreSQL
- External services behind validated server boundaries

Exact module mapping is `UNVERIFIED` by this documentation task.

## Authentication model

Auth.js provides the reported authentication direction, with Argon2id password hashing. Protected operations must not trust presentation fields alone and must reject invalid, stale, or disabled actor state. Exact session implementation remains subject to repository inspection.

## Authorization and capability model

Database capability assignments are authoritative. Protected operations reload and validate the actor from the database rather than trusting client input, URLs, forms, local storage, JWT claims, or session presentation fields.

Approved roles:

- `STUDENT`
- `STAFF`

Approved capabilities:

1. `MANAGE_STUDENT_ACCOUNTS`
2. `REACTIVATE_STUDENT_ACCOUNTS`
3. `MANAGE_STAFF_ACCOUNTS`
4. `MANAGE_STAFF_CAPABILITIES`
5. `PROCESS_REQUESTS`
6. `MANAGE_REQUEST_CATEGORIES`
7. `GENERATE_DOCUMENTS`
8. `RELEASE_DOCUMENTS`
9. `REVOKE_DOCUMENTS`
10. `REGISTRY_IMPORT_UPLOAD`
11. `REGISTRY_IMPORT_APPROVE`
12. `FINANCE_IMPORT_UPLOAD`
13. `FINANCE_IMPORT_APPROVE`
14. `VIEW_FINANCE`
15. `VIEW_AUDIT_LOG`
16. `EXPORT_STUDENT_DATA`
17. `EXPORT_REQUEST_DATA`
18. `EXPORT_FINANCE_DATA`

## Database-authoritative actor validation

Before protected work, reload the actor and validate identity, role, account status, session state, capability, and ownership where applicable. Client-controlled values cannot grant roles or capabilities.

## Ownership enforcement

Apply ownership constraints in trusted server queries and mutations, not only in navigation or UI filtering. Denied and cross-user paths require tests.

## Account lifecycle

Disabled accounts cannot perform protected operations. Students cannot receive staff capabilities. Self-grant is forbidden. Protect the final active holder of `MANAGE_STAFF_CAPABILITIES` from revocation, disabling, or conversion to an ineligible role, including concurrent check-then-write races.

## Legacy ADMIN conversion

The current role model contains only `STUDENT` and `STAFF`. The Package E
migration converts every historical ADMIN to STAFF atomically, preserves each
account's existing capability assignments without escalation, invalidates its
sessions, records a redacted system audit event, and fails closed unless an
active capability manager survives. Historical migrations retain ADMIN literals
as immutable migration records; runtime code cannot assign or authorize ADMIN.

## Audit requirements

Sensitive actions require attributable, typed, minimal, sanitized audit metadata. Secrets, hashes, tokens, and unnecessary personal data are excluded. Failure to create a required audit record must roll back its protected mutation.

## External services

Neon PostgreSQL and planned Vercel deployment are reported directions. Notification, storage, and other provider choices are `UNVERIFIED` unless repository evidence confirms them.

## Deployment direction

Vercel is the planned deployment direction. Production deployment, access, monitoring, backup, and recovery require separate approval and evidence.

## Architecture invariants

- Authorization is enforced server-side.
- Client-side hiding is not authorization.
- Students cannot access another student's records.
- Students cannot execute staff operations.
- Disabled accounts cannot perform protected operations.
- Registration cannot create privileged accounts.
- Client input cannot grant roles or capabilities.
- Zero-capability staff accounts remain safe.
- Sensitive mutations should be transactional.
- Required audit failure must roll back protected mutations.
- Private staff notes never appear to students.
- Documents remain private unless securely released.
- Imports are untrusted input; raw uploaded files are not retained.
- Destructive operations require explicit approval.

## Known unverified areas

- Package E migration execution, rollback, locking, enum replacement, and rerun
  behavior against an isolated PostgreSQL database
- Exact route, component, module, and server-action inventory
- Current production topology and operational controls
- Production Vercel Blob provisioning and credentials, deferred to V2-12
- Institutional artifact-retention duration; V2-9 preserves legitimate
  artifacts and deletes only unreferenced orphan objects
- Full implementation coverage of the stated invariants

See [ROADMAP.md](ROADMAP.md), [CURRENT_STATE.md](CURRENT_STATE.md), and [TASK_PACKAGE.md](TASK_PACKAGE.md).
