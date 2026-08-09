# Storage, email, and observability operations

## Boundary

This V2-12.5 control set prepares private document storage, transactional email
delivery, liveness monitoring, and incident handling. It does not activate a
provider, send real email, access Production, or authorize a live release.

Production and Preview must use separate Blob stores, Resend API keys, sender
identities, and scheduler secrets. Document files remain private and are served
only by the existing authenticated download routes. Provider URLs, API keys,
student data, document metadata, and raw exception payloads must not be put in
logs, alerts, tickets, or status responses.

## Provider readiness

Before enabling document generation or email delivery in an environment, the
named storage and email owners must configure that environment only with:

| Variable                                   | Purpose                    | Requirement                                                                                    |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` or `BLOB_STORE_ID` | private Blob identity      | one non-empty provider identity; never shared across Preview/Production                        |
| `RESEND_API_KEY`                           | Resend credential          | scoped to the environment and approved sender domain                                           |
| `EMAIL_FROM`                               | sender address             | verified sender for the target use; Preview may use Resend onboarding only for synthetic smoke |
| `CRON_SECRET`                              | Vercel Cron authentication | cryptographically random secret of at least 32 characters; scheduler scope only                |

Generate `CRON_SECRET` with a cryptographically secure random generator; its
origin cannot be proven by the application, but the verifier and scheduler both
fail closed for absent or fewer-than-32-character values. Run
`npm run operations:verify` in the target deployment scope. It performs no
network access and returns categories only; it never prints provider values.
The existing `npm run production:verify` remains required for Production
application configuration. A successful verifier result is structural evidence,
not proof of provider identity, sender-domain verification, storage privacy, or
delivery.

The Vercel schedule in `vercel.json` invokes the protected internal delivery
route every five minutes. The route returns `404` for absent or invalid scheduler
credentials, `503` for configuration/dependency failure, and a count-only
summary after a successful bounded outbox run. It must not be called from a
browser or exposed as an application API. The existing outbox remains the
authoritative retry, idempotency, and terminal-failure record.

## Monitoring and logs

- `GET /api/health` is a liveness endpoint only. It returns an uncached
  `{"status":"ok"}` response and intentionally does not disclose database,
  storage, email, version, environment, or configuration state.
- Structured operational records contain an event name, level, generated
  correlation identifier, and allowlisted non-personal metadata only. Do not
  pass exceptions, request bodies, headers, URLs, user IDs, email addresses,
  document IDs, database IDs, or secrets to the logger.
- Monitor the health route for availability and alert on consecutive failures.
  Monitor the scheduled route for repeated `503`, and use the database-backed
  outbox status/attempt count for delivery backlog and terminal-failure alerts.
  Alerts contain only environment, event class, time window, and correlation ID.

The monitoring/error-reporting provider, alert destinations, retention period,
and named on-call owner are external owner decisions. Do not enable a provider
SDK or export application data until those decisions are recorded.

## Incident procedure

1. Classify availability, delivery, storage, credential, privacy, or suspected
   compromise impact. Record a correlation ID and sanitized timestamps only.
2. Stop the affected scheduler or provider credential when continued delivery
   could increase impact. Do not delete outbox, document, audit, or student data.
3. Notify the deployment owner, provider owner, database owner when relevant,
   and the institutional incident contact. Escalate suspected private-data or
   credential exposure immediately.
4. Contain and rotate the affected environment-scoped provider or scheduler
   secret. Re-run the non-network verifiers and perform a minimal synthetic
   smoke check only after owner approval.
5. Recover by replaying eligible pending outbox rows through the existing
   idempotent dispatcher. Do not manually resend from logs or provider consoles.
   For document issues, preserve the artifact/audit record and follow the
   existing recovery/rollback runbook.
6. Record the impact, decisions, sanitized evidence, recovery result, and
   follow-up owner. Never include student data, secrets, provider URLs, or raw
   request/error payloads.

## Owner checkpoint required before provider activation

Recorded owner evidence: the Vercel Preview deployment is Ready; Preview and
Production use separate Resend API keys and separate scheduler secrets; the
Preview key was rotated after an invalid/old-key issue; a direct Resend
synthetic smoke using the new Preview key returned an email ID; and UptimeRobot
checks Preview every five minutes, reports Up, and its email notification was
tested. Preview uses `SIST Portal Preview <onboarding@resend.dev>` only as a
Resend onboarding sender for that Preview smoke, not as verification of an
institutional sender domain.

The sole remaining external manual checkpoint is to obtain access to the
existing `sist.ac.ma` Cloudflare DNS zone, install the Resend DNS records for
`updates.sist.ac.ma`, and wait for Resend to verify that institutional sender
domain. The current Cloudflare account lacks that zone access. Do not create a
duplicate zone or claim institutional-domain verification before this succeeds.
