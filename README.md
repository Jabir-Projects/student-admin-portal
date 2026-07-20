# Student Administration Portal

A production-oriented university portal connecting students with administration.
Phase 1 establishes the application foundation only; authentication, persistence,
student workflows, and administrator workflows are intentionally not implemented.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` when environment values are needed. Never
commit `.env.local` or real credentials.

## Quality checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for boundaries, security
requirements, and the planned feature structure.
