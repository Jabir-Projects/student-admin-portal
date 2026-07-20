# Database

## Scope

Phase 2 provides the database foundation only. It does not implement
authentication, authorization, request workflows, notifications UI, exports,
uploads, email, or deployment.

## Connections and runtime

- `DATABASE_URL` is the pooled Neon PostgreSQL connection used by the application
  Prisma Client and development seed.
- `DIRECT_URL` is the direct Neon PostgreSQL connection used by Prisma CLI and
  migration operations.
- `TEST_DATABASE_URL` is optional and reserved for isolated database integration
  tests.
- Prisma configuration and runtime utilities explicitly load the project-root
  `.env.local` through dotenv. They never log connection values.
- The checked-in example environment file contains variable names only.

The application client uses `@prisma/adapter-pg` in the standard Next.js Node.js
runtime. The module under `src/server/db` is server-only and must never be imported
by Client Components, middleware, or Edge runtime code. Do not add
`@prisma/adapter-neon` alongside the approved PostgreSQL adapter.

## Data model

| Model                  | Purpose                                                  | Deletion behavior                                                                          |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `User`                 | Student or administrator identity foundation             | Dependent profile and notifications cascade; historical actor references restrict deletion |
| `StudentProfile`       | One-to-one student record with unique student number     | User deletion cascades; requests restrict profile deletion                                 |
| `RequestCategory`      | Unique named and slugged request type                    | Requests restrict category deletion                                                        |
| `DocumentRequest`      | Student request with unique sequence-generated reference | History and messages restrict deletion; notification link becomes null                     |
| `RequestStatusHistory` | Immutable request-state transition record                | Request and actor deletion are restricted                                                  |
| `RequestMessage`       | Public or internal request communication                 | Request deletion is restricted; deleted author becomes null                                |
| `Notification`         | User-facing database notification record                 | User deletion cascades; deleted request link becomes null                                  |
| `AuditLog`             | Immutable event record with PostgreSQL JSONB metadata    | Actor deletion is restricted                                                               |

Mutable records have `createdAt` and `updatedAt`. Append-only status-history and
audit records have only `createdAt`, because an update timestamp would imply a
mutation that the database forbids.

## Database-enforced invariants

- User email, student number, category name, category slug, and request reference
  are unique.
- `DocumentRequest_copyCount_check` requires `copyCount > 0`.
- Request references use `document_request_reference_seq` and the format
  `REQ-00000001`. Sequence allocation is concurrency-safe and intentionally may
  contain gaps after rolled-back transactions.
- `RequestStatusHistory_append_only` and `AuditLog_append_only` reject every
  `UPDATE` and `DELETE` at the database boundary.
- Foreign keys and deletion behavior are explicit in the checked-in migration.

## Migrations

Development workflow:

```bash
npm run db:format
npm run db:validate
npx prisma migrate dev --name descriptive_name
npm run db:generate
npm run db:status
```

Review generated SQL before applying it, especially custom constraints, sequences,
triggers, foreign keys, and deletion rules. Commit the complete
`prisma/migrations` directory. Apply checked-in migrations in production with:

```bash
npx prisma migrate deploy
```

Never use `prisma db push` as the production migration strategy. Never run a
destructive database reset against shared or production data.

## Development seed

Run the development-only seed with:

```bash
npm run db:seed
```

The seed is repeatable. Mutable fixtures use deterministic IDs and intentional
upserts. Immutable status-history fixtures use deterministic IDs with
`createMany({ skipDuplicates: true })`, so reruns never update or delete them.

Seed users contain the literal marker
`PHASE_2_NON_AUTHENTICATING_PLACEHOLDER_HASH_REPLACE_IN_PHASE_3`. It is not a
password hash and cannot authenticate anyone. Phase 3 must replace all placeholder
values when authentication and password hashing are implemented.

## Testing

Vitest includes pure environment-validation tests, migration SQL contract tests,
and non-destructive reads against the seeded development database. An optional
isolated connectivity test runs only when `TEST_DATABASE_URL` is configured.
Database tests never reset, truncate, delete, or mutate the Neon database.
