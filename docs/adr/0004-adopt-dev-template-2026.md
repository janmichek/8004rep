# ADR 0004: Adopt dev-template-2026

## Status

Accepted

## Context

8004rep started as a Vue + Vite explorer. The project needed the strict Feature-Sliced React toolchain from `dev-template-2026` (Hono API contract, Steiger, oxlint/oxfmt, coverage floors, Playwright, commitlint).

## Decision

Rebase the application onto `dev-template-2026`. Replace the car-lot sample domain with an ERC-8004 agent roster and network filter. Keep planning research under `docs/legacy/`.

## Consequences

- The UI stack is React 19 + TanStack Router/Query + Hono instead of Vue.
- Domain data is fixture-backed through `/api/agents` and `/api/networks` for now; live chain reads and the indexer can replace `server/data.ts` later without changing the FSD boundaries.
- Finish line remains `bun run validate`.
