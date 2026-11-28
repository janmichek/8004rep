# ADR 0006: On-chain indexer and independent reputation

## Status

Accepted, supersedes [ADR 0005](./0005-agent-list-proxy.md).

## Context

ADR 0005 proxied `GET /api/agents` to 8004scan. That made a third-party ranking the source of the
agent directory, the network totals and the starred rows, and it meant 8004rep’s own `rep-1.0`
formula was only visible on single-agent pages. The proxy also inherited 8004scan’s rate limit,
sort fields and score semantics, none of which are part of the ERC-8004 registries.

The registries expose immutable feedback events. They can be indexed once, stored in PostgreSQL and
scored deterministically, so every primary view can read owned data.

## Decision

- Add a reorg-safe event indexer in `server/indexer/` that reads Identity and Reputation events,
  materializes agents, transfers, metadata, feedback and responses, and stores a cursor per chain.
- Store data in PostgreSQL through parameterized queries and versioned SQL migrations.
- Publish `rep-1.0` as `shared/reputation/`, served by `GET /api/reputation/spec`, and materialize
  chain-wide tag scales plus per-agent scores.
- Serve `/api/agents`, `/api/agents/{chainId}/{tokenId}`, the reputation endpoint,
  `/api/networks` and `/api/networks/{chainId}/stats` from the owned stores.
- Keep 8004scan only as a live comparison value on the agent detail page and the “vs 8004scan” tab.
- Run the API on the Vercel Node.js runtime so `postgres.js` can use `DATABASE_URL`.

## Consequences

- The agent list, network totals, starred rows and agent pages no longer depend on 8004scan.
- The indexer must be operated (migrations, backfill, polling) and monitored; an unreachable chain
  or database degrades to a 503 instead of a proxy 502.
- Scores are reproducible: the same formula runs in the worker and the browser, and every response
  carries its formula version and a canonical-input hash.
- 8004scan data is structurally limited to the comparison tile/tab, and the unused scan fetchers
  are removed.
- ADR 0005’s sort restriction (`created_at`, `total_score`, `total_feedbacks`) no longer applies;
  SQL orders by score, feedback count, registration time and token id with unrated rows last.
