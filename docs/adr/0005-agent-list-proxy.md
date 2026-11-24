# ADR 0005: Proxy the agent list through the API

## Status

Accepted

## Context

The agents page called 8004scan directly from the browser. Sorting was a third-party query string, the page spent the anonymous upstream rate limit, and the API contract could not describe the response the table actually rendered.

## Decision

`GET /api/agents` accepts `q`, `chain`, `env`, `sort=registered|score|feedback`, `order`, `page`, and `pageSize`. The Hono app proxies 8004scan, validates the envelope and every row against `shared/schemas.ts`, and returns the contract page. The Score, Feedback, and Registered headers write those params to the URL; `fetchAgents` reads them through the generated client. The same Hono app is bundled into the Vercel edge function by `api/index.ts`, so production and the Bun container share one implementation.

## Consequences

- The browser only talks to our origin; 8004scan becomes a server dependency with a 10-second timeout and a 502 when it is unreachable.
- Sort fields stop at what 8004scan can order: `created_at`, `total_score`, and `total_feedbacks`, exposed as `registered`, `score`, and `feedback`. Sorting by token ID would need the SQL indexer, which is not deployed here.
- The `hasMore` pager comes from the upstream envelope, so the table never derives its own cursor.
- Adding a sort means a Zod enum value, the field mapping in `server/scanAgents.ts`, and a header in `AgentList.tsx`; the OpenAPI query type updates through `bun run api:generate`.
