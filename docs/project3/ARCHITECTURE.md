# Project 3 Architecture

## Purpose

Document stable system boundaries and security invariants without duplicating implementation detail or the Prisma schema. Workflow decisions are in [DECISIONS.md](DECISIONS.md); verification expectations are in [VERIFICATION_MATRIX.md](VERIFICATION_MATRIX.md).

## System context

The SIST Portal is an institutional Next.js application serving student and staff workflows over PostgreSQL through server-only data access. Exact routes, components, integrations, and deployed topology not verified by CTRL-001 remain `UNVERIFIED`.

## Main actors

- `STUDENT`: accesses only authorized personal student services and records.
- `STAFF`: performs only operations granted by database-authoritative capabilities.
- Temporary legacy `ADMIN`: compatibility and migration state only; never a universal bypass.

## Trust boundaries

### Student boundary

Student identity is established server-side. Ownership is enforced on every protected record query or mutation; another student's records and staff operations remain inaccessible.

### Staff boundary

Staff access requires a valid actor, active account, valid session state, eligible role, and the required database capability. Zero-capability staff accounts remain safe.

### Administrative request boundary

Administrative requests must validate actor authority, request state, input, ownership where applicable, transactional behavior, and required audit creation.

### Notification boundary

Notifications must minimize sensitive content, validate recipients, and avoid treating delivery presentation as authorization. Provider and implementation details are `UNVERIFIED`.

### Import trust boundary

Registry and finance uploads are untrusted input. Upload and approval are separate capabilities; validation, authorization, deterministic handling, and safe failure are required.

### Document and private-storage boundary

Generated documents remain private unless securely released to an authorized recipient. Release and revocation are separately authorized operations. Storage provider details are `UNVERIFIED`.

### Finance boundary

Finance data is private. Viewing, upload, approval, and export require their distinct capabilities and appropriate transaction and audit controls.

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
- Temporary legacy `ADMIN`

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
- Imports are untrusted input.
- Destructive operations require explicit approval.

## Known unverified areas

- Exact route, component, module, and server-action inventory
- Current production topology and operational controls
- Notification and private-storage providers
- Full implementation coverage of the stated invariants

See [ROADMAP.md](ROADMAP.md), [CURRENT_STATE.md](CURRENT_STATE.md), and [TASK_PACKAGE.md](TASK_PACKAGE.md).
