# Authentication and account approval

Phase 3 uses Auth.js Credentials with email/password authentication and an
eight-hour JWT session. There is no OAuth, email verification, password reset, or
Auth.js database adapter. Session data contains only user ID, role, and status.

Public registration always creates a `STUDENT` in `PENDING_APPROVAL`. The Student
Number is supplied by the applicant. SIST has not provided an authoritative file,
database, or API, so Phase 3 does not claim institutional verification; an active
administrator must approve the account manually.

`src/proxy.ts` provides optimistic routing only and never accesses Prisma. Pages,
route handlers, and Server Actions enforce authentication and role. Sensitive
operations use the server-only DAL to re-read PostgreSQL, confirm `ACTIVE` status,
confirm role, and enforce ownership close to data access. Stale JWT claims are not
trusted as the final authorization decision.

Passwords are limited before Argon2id work and are never logged or audited. The
development seed requires `SEED_ADMIN_PASSWORD`, `SEED_STUDENT_ONE_PASSWORD`, and
`SEED_STUDENT_TWO_PASSWORD`; values remain in ignored local configuration. A
durable distributed login and registration rate limiter is still required before
production deployment. An in-memory serverless limiter is intentionally omitted.
