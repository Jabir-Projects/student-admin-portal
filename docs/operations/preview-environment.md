# Preview environment

Preview is strictly non-Production: use synthetic or sanitized data only; never
share Production student data, databases, secrets, storage, email, or auth.

Required variables are `APP_URL`, `DATABASE_URL`, `DIRECT_URL`,
`TEST_DATABASE_URL`, and `AUTH_SECRET`, with Preview-only resources and a
distinct isolated PostgreSQL test database.

Run `npm run preview:verify` first. Default validation performs no network
activity and emits only hashed fingerprints; it rejects missing, malformed,
identical, Production-classified, or unknown targets. `--probe` requires future
approved identity verification. After conclusive isolation proof and migration
review, run `npm run test:integration:postgresql`; never reset, seed, or
destructively test Production.

Preview deployment requires passing CI, approved branch/commit, existing Vercel
authentication/linkage, Preview-only variables, no Production flag, evidence,
and rollback/removal ownership. Future app gates include availability, login,
security headers, unauthenticated boundaries, and V2-5 through V2-10 Chromium
coverage with workers=1, retries=0, synthetic users, safe storage/email, and
cleanup evidence.

## OWNER DECISION REQUIRED

Vercel owner/project and deployment approver; Preview URL; Preview and isolated
test database owners; secret custodian; storage/email configuration; cleanup
owner; retention policy; and operational contacts.

## Local Pack 3A verification

The Preview verifier, its type-only declaration, and its focused test are
complete. The focused verifier test passed (1 file, 2 tests), and `test:ci`
passed with 74 files and 691 tests. Changed-file formatting, ESLint, strict
TypeScript checking, and Prisma validation also passed with synthetic,
unreachable localhost configuration.

The application previously imported Google fonts during the production build.
That dependency is now replaced by an offline system-font stack while retaining
the existing font CSS variable names. No font asset was downloaded and no
external resource was contacted. The offline production build passed, generated
31 static pages, and listed 38 application routes.

The exact ten-file `test:integration:postgresql` command exists but was not
executed. No remote database identity proof, migration, Vercel deployment,
Preview E2E, or Production access occurred. These remain external V2-12.3
gates.
