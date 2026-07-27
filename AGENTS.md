# AGENTS.md — SIST Portal V2

## Project

This repository contains the existing:

**SIST Student Services and Administration Portal V2**

It is a real institutional application that may process student, academic, administrative, financial, authentication, audit, and document data.

Security, correctness, privacy, traceability, and maintainability take priority over speed.

Do not redesign the product, rebuild approved work, expand scope, or begin later packages without explicit approval.

---

## Working Method

For every task:

1. Verify the repository, environment, worktree, Git state, and current package.
2. Inspect relevant files before proposing changes.
3. Work on exactly one approved task or package.
4. Establish included scope, excluded scope, allowed boundaries, and acceptance criteria.
5. Create the smallest evidence-based plan.
6. Wait at required approval gates.
7. Modify only approved files or feature boundaries.
8. Run verification proportional to the changed risk.
9. Review the final diff.
10. Request approval before Git writes.
11. Close the package and stop.

“One step at a time” means one meaningful engineering gate at a time, not one harmless command at a time.

Do not begin the next package automatically.

---

## Source of Truth

Use this evidence order:

1. Current repository files
2. Current Git and worktree state
3. Current Prisma schema and checked-in migrations
4. Verified database state when access is explicitly authorized
5. Current approved task package
6. Approved decisions and project documentation
7. Historical reports
8. Assumptions

Repository evidence overrides older reports.

Use these labels when needed:

* `VERIFIED`
* `REPORTED`
* `UNVERIFIED`
* `NEEDS OWNER DECISION`
* `BLOCKED`

Never invent files, functions, routes, models, migrations, database state, commands, command output, tests, results, Git state, commits, business rules, security findings, or owner approval.

Never present an assumption as verified fact.

---

## Project Control Documents

When present, read the relevant files:

* `docs/project3/CURRENT_STATE.md`
* `docs/project3/ROADMAP.md`
* `docs/project3/DECISIONS.md`
* `docs/project3/TASK_PACKAGE.md`
* `docs/project3/VERIFICATION_MATRIX.md`
* `docs/project3/ARCHITECTURE.md`

Do not create or modify these files without approval.

Report conflicts between documentation and repository evidence.

---

## Technology and Architecture

Preserve the existing stack:

* Next.js App Router
* React
* TypeScript strict mode
* Tailwind CSS
* shadcn/ui
* Zod
* React Hook Form where useful
* PostgreSQL on Neon
* Prisma ORM
* Auth.js
* Argon2id
* Vitest
* Playwright
* ESLint
* Prettier
* Git and GitHub
* Vercel later

Read exact versions from repository files.

Before version-specific Next.js work:

1. Inspect the installed Next.js version.
2. Consult:
   `node_modules/next/dist/docs/`
3. Prefer documentation matching the installed version.

Architecture rules:

* Use Server Components by default.
* Use Client Components only for genuine interactivity.
* Keep business logic outside page components.
* Keep database access in server-only modules.
* Validate untrusted server input with Zod.
* Preserve TypeScript strict mode.
* Preserve server/client boundaries.
* Prefer small additive changes.
* Use reviewed Prisma migrations.
* Never use `prisma db push` as the production migration strategy.
* Do not add or upgrade dependencies without approval.
* Do not introduce a separate Express backend, microservices, online payments, AI features, or unnecessary infrastructure.

---

## Security

Mandatory rules:

* Enforce authorization server-side.
* Client-side hiding is not authorization.
* Revalidate identity, role, account status, session state, capability, and ownership where applicable.
* Students must never access another student’s data.
* Students must never access staff functionality.
* Disabled users must not perform protected operations.
* Public registration must never create privileged accounts.
* Client input must never grant privileges.
* A zero-capability `STAFF` account must remain safe.
* Private staff notes must never be exposed to students.
* Passwords must remain securely hashed.
* Secrets and environment values must never be printed, logged, or committed.
* Sensitive mutations must be transactional when required.
* Required audit failure must roll back its related sensitive mutation.
* Audit metadata must be typed, minimal, and sanitized.
* Generated documents must remain private.
* Spreadsheet imports must be treated as untrusted input.
* Security tests must include denied and cross-user access paths.
* Destructive operations require explicit approval.

Approved roles:

* `STUDENT`
* `STAFF`
* Temporary legacy `ADMIN`

`ADMIN` is a compatibility and migration state only. It must not receive a universal bypass.

Database capability assignments are authoritative.

Never trust authorization values from client input, URLs, forms, local storage, JWT claims, or session presentation fields.

Approved capability identifiers:

* `MANAGE_STUDENT_ACCOUNTS`
* `REACTIVATE_STUDENT_ACCOUNTS`
* `MANAGE_STAFF_ACCOUNTS`
* `MANAGE_STAFF_CAPABILITIES`
* `PROCESS_REQUESTS`
* `MANAGE_REQUEST_CATEGORIES`
* `GENERATE_DOCUMENTS`
* `RELEASE_DOCUMENTS`
* `REVOKE_DOCUMENTS`
* `REGISTRY_IMPORT_UPLOAD`
* `REGISTRY_IMPORT_APPROVE`
* `FINANCE_IMPORT_UPLOAD`
* `FINANCE_IMPORT_APPROVE`
* `VIEW_FINANCE`
* `VIEW_AUDIT_LOG`
* `EXPORT_STUDENT_DATA`
* `EXPORT_REQUEST_DATA`
* `EXPORT_FINANCE_DATA`

Students cannot receive staff capabilities.

Self-grant is forbidden.

Protect the final active holder of `MANAGE_STAFF_CAPABILITIES` against revocation, disabling, and conversion to an ineligible role.

Concurrency controls must prevent check-then-write races.

---

## Scope and Permissions

Before implementation, establish:

* Exact objective
* Included work
* Excluded work
* Allowed files or feature boundary
* Acceptance criteria
* Required verification
* Database permission
* Git permission
* Stop conditions

Read-only inspection does not require write permission.

File-edit permission does not automatically allow:

* Database access
* Migrations
* Seeds
* Dependency installation
* Commit
* Push
* Merge
* Deployment

Return `BLOCKED` only when the problem prevents the current approved action.

---

## Verification

Match checks to the changed risk.

### Documentation-only

* Content review
* Path or link validation
* Diff review

### Styling-only frontend

* Visual review
* Responsive review
* Accessibility-focused review
* Lint
* Typecheck
* Build once
* Component tests only when behavior changed

### Frontend behavior

* Targeted component or interaction tests
* Responsive review
* Accessibility review
* Lint
* Typecheck
* Build once

### Normal backend

* Targeted unit tests
* Relevant integration tests
* Lint
* Typecheck
* Build once

### High-risk work

Authentication, authorization, account lifecycle, imports, exports, finance, private documents, and migrations normally require:

* Targeted tests
* Relevant integration tests
* Negative authorization tests
* One security review
* Lint
* Typecheck
* Build once

Never describe focused checks as a full repository pass.

Report exact commands, exit codes, pass/fail/skip counts, checks not run, and reasons for omissions.

Do not weaken meaningful assertions to obtain a pass.

---

## Database Safety

Never connect to or mutate a database without explicit authorization for the exact task.

Never:

* Run `prisma db push`
* Reset a shared database
* Run seeds without approval
* Access Production during testing
* Delete unrelated data
* Delete append-only audit history
* Use broad cleanup
* Casually edit applied migrations
* Claim database verification without authorized access

Test cleanup must affect deterministic suite-owned fixtures only.

Before migration execution:

1. Inspect migration SQL.
2. Review data-loss risks.
3. Review constraints and indexes.
4. Confirm the target database.
5. Confirm recovery or roll-forward strategy.
6. Confirm the exact command.
7. Obtain explicit approval.

---

## Git Safety

Without explicit Git-write approval, use read-only Git operations only.

Do not run without approval:

* `git add`
* `git commit`
* `git push`
* `git merge`
* `git rebase`
* `git reset`
* `git stash`
* `git checkout`
* `git switch`
* Branch creation or deletion
* `git cherry-pick`

Never:

* Force push
* Rewrite shared history
* Commit secrets or environment files
* Commit unrelated changes
* Mix packages in one commit
* Perform normal implementation directly on `main`

Codex-managed worktrees may use a detached `HEAD`.

Do not report a mismatch solely because a normal branch is absent. Verify repository identity, base commit, current diff, and intended delivery workflow.

Before commit:

1. Inspect every changed path.
2. Confirm every path belongs to the package.
3. Stage approved paths only.
4. Use the approved commit message.

After push:

* Verify local and remote commits.
* Verify ahead/behind is `0/0`.
* Verify the working tree is clean.

---

## SIST UI/UX

The interface must feel:

* Institutional
* Professional
* Trustworthy
* Calm
* Accessible
* Purpose-built for SIST

Use the approved visual direction:

* Deep navy
* Controlled green accents
* White and neutral surfaces
* Strong typography
* Purposeful spacing
* Thin borders
* Minimal shadows
* Correct logo proportions
* Light and dark modes where approved

Avoid:

* Fake statistics
* Fake institutional information
* Fake AI student photographs
* Generic SaaS layouts
* Excessive gradients
* Excessive rounded cards
* Duplicated logos
* Unapproved redesigns

Known preferences:

* Long top search bar
* No `Help & Support` sidebar item
* No `Logout` sidebar item
* No duplicated small SIST logo
* Capability-aware navigation
* Desktop, tablet, and mobile support

Do not implement a visual package before Design Lock approval.

Capability-aware navigation is presentation only. Server authorization remains mandatory.

---

## Communication

Use simple, direct, professional language.

Use emojis only to organize reports:

* 🧭 State
* 🎯 Objective
* 📦 Scope
* 🔍 Inspection
* 🛠️ Changes
* 📁 Files
* 🧪 Tests
* 🔐 Security
* 🗄️ Database
* 📌 Git
* ⚠️ Blocker
* ✅ Decision
* ➡️ Next action

Do not place decorative emojis in source code, commands, paths, tests, database values, technical identifiers, or commit messages.

Do not repeat project history unnecessarily.

Do not provide fake terminal output, unsupported confidence, time estimates, or promises of background work.

Ask questions only when the missing answer truly blocks the current action.

---

## Standard Report

Use a concise report:

🧭 **State:**
[Environment, phase, package, worktree, and branch or detached HEAD]

🎯 **Objective:**
[Approved objective]

📦 **Scope:**
[Included and excluded work]

🔍 **Inspection:**
[Verified findings]

🛠️ **Changed:**
[Precise summary or `None — read-only work`]

📁 **Files:**
[Exact paths]

🧪 **Verification:**
[Commands actually run and factual results]

🔐 **Security:**
[Relevant result or `Not applicable`]

🗄️ **Database:**
[Permission, access, and mutation state]

📌 **Git:**
[HEAD, working tree, commit, push, and remote alignment]

⚠️ **Blocker:**
[Exact blocker or `None`]

✅ **Decision:**
[One exact decision]

➡️ **Next action:**
[One safe next action]

Do not begin the next action automatically.

---

## Completion

A package is complete only when:

* Acceptance criteria pass.
* Required checks and QA pass.
* Blocking findings are corrected.
* Approved commit and push are complete.
* Local and remote states match.
* Ahead/behind is `0/0`.
* Working tree is clean.
* Package closure is approved.

A phase is complete only when all approved packages and integrated verification pass.

The project is complete only after verified production release, security, accessibility, monitoring, backup, recovery, documentation, synchronized Git state, and explicit project-owner approval.