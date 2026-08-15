# Monday demo and handoff

## Status

Repository work is ready for university demonstration and handoff. Preview is
deployed and monitored. Production deployment, promotion, migration, and access
were not performed.

For the Monday/V2 Preview, `vercel.json` uses the Vercel Hobby-compatible daily
Cron schedule `0 0 * * *` (UTC) for the protected outbox dispatcher. Do not rely
on immediate scheduled email dispatch during the live demo. The previously
verified Resend Preview synthetic delivery remains valid infrastructure evidence,
and the portal's in-app notifications and workflow remain demonstrable.
Higher-frequency scheduled dispatch can be restored when an appropriate
infrastructure or Vercel plan is available. Official institutional email/domain
work remains deferred to V3. Production remains untouched.

`updates.sist.ac.ma` is **DEFERRED — EXTERNAL INSTITUTIONAL DEPENDENCY /
POST-HANDOFF**. Repository implementation is complete, but an authorized
institutional DNS owner must access the existing `sist.ac.ma` Cloudflare zone and
install Resend records before arbitrary production email sending can be enabled.
The Preview `onboarding@resend.dev` sender is a test sender only.

## Local demo setup

Use a dedicated disposable local or approved isolated demo PostgreSQL database;
never use Preview or Production data. Copy `.env.example` to ignored `.env.local`
and provide local/approved database URLs, `AUTH_SECRET`, and one unique
12+-character `SEED_DEMO_PASSWORD` value outside Git.

With the non-Production target confirmed:

```bash
npm ci
npm run db:deploy
npm run db:seed
npm run dev
```

`db:seed` refuses Production and requires `ALLOW_DEVELOPMENT_SEED=true`. It only
creates deterministic `@example.invalid` fixtures. Do not use `prisma db push`,
reset a shared database, or seed Preview/Production.

For a live local document-download demo, configure a dedicated private Blob
identity and the environment-scoped email/scheduler values in
[storage-email-observability.md](storage-email-observability.md). Test-memory
storage is test-only.

## Demo actors and data

| Actor         | Identity                          | Purpose                                                                       |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| Demo manager  | `admin.dev@example.invalid`       | Active STAFF account with all approved capabilities.                          |
| Demo reviewer | `reviewer.dev@example.invalid`    | Active STAFF account with Registry and Finance approval capabilities.         |
| Student one   | `student.one.dev@example.invalid` | Active student with an under-review request, notifications, and Finance data. |
| Student two   | `student.two.dev@example.invalid` | Active student with a submitted request for processing.                       |

The seed also provides three `SIST-DEMO-*` registry entries, request categories,
request history, and deterministic Finance charge/payment data. Passwords are
owner-supplied only and are never committed.

## Monday demo script (5–10 minutes)

1. Open landing, registration, pending approval, and accessible login.
2. Sign in as Student one: dashboard, request tracking/timeline, notifications,
   profile, Finance statement, then submit a service request.
3. Sign out; show protected-route redirect and `/unauthorized` generic behavior.
4. Sign in as Demo manager: staff dashboard, queue transition, public/internal
   notes, categories, student administration, and audit view.
5. Show Documents only with private Blob configured; otherwise explain the
   documented provider prerequisite rather than attempting a live delivery.
6. Prepare a Registry/Finance import as Demo manager, then sign in as Demo
   reviewer to demonstrate independent four-eyes approval and Finance export.
7. Close with `/api/health`, Preview/UptimeRobot evidence, and environment
   separation. Never call the protected scheduler endpoint from a browser.

There is no repository-provided manual or browser-controlled dispatcher trigger
for the demo. The scheduled route remains internal and requires its protected
`CRON_SECRET` bearer authorization; do not create or use an unprotected
workaround.

## Handoff scope and limitations

Implemented: registration and session handling; student-owned requests,
documents, notifications, and Finance; capability-authorized STAFF operations;
Registry/Finance four-eyes imports; private document controls; sanitized audit;
exports; liveness; and protected scheduled notifications.

- Production is not deployed or promoted; use the production-readiness runbook
  only after explicit owner approval.
- `npm audit --omit=dev` reports one high upstream `nanoid` advisory through
  PostCSS. Installed `nanoid` is 3.3.16; no freeze-period dependency update was
  made without compatibility review.
- Physical-device, real screen-reader, and institutional operational-owner
  checks remain follow-up work.

After handoff, retain this branch and use the dedicated demo database. Schedule
the DNS/domain task only with the institutional Cloudflare administrator.
