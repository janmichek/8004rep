# 8004rep

Read-only ERC-8004 agent reputation explorer with an owned on-chain index and a published
`rep-1.0` score. 8004scan is kept only for side-by-side comparison.

## Start

You need [Bun](https://bun.sh) and Docker.

```sh
cp .env.example .env
bun install
bun run dev
```

`docker compose up` starts PostgreSQL, the API/UI on http://localhost:3001 and the indexer. The
first backfill can take a while; `INDEXER_CHAINS=84532` limits it to one network while you try it.

Without Docker:

```sh
docker compose up -d postgres
bun run db:migrate
bun server/index.ts
bun run indexer
bun run start
```

The UI is http://localhost:3000 and proxies `/api` to port 3001. A server without `DATABASE_URL`
still starts: primary routes answer 503 instead of proxying 8004scan.

## Pages

| Page    | Route               | What it shows                                                       |
| ------- | ------------------- | ------------------------------------------------------------------- |
| Agents  | `/agents/all`       | Ranked roster, filter, search, `rep-1.0` score and confidence       |
| Agent   | `/agents/$slug/$id` | `rep-1.0` report, feedback, reviewers, identity, vs 8004scan        |
| Network | `/network/$slug`    | Totals from the index, indexed block height, loaded feedback window |
| Starred | `/starred`          | Pinned agents, owners and reviewers with owned scores               |
| Docs    | `/docs`             | Formula, API, calibration, limits and glossary                      |

## API

The contract is [`shared/schemas.ts`](shared/schemas.ts). Change the Zod schema, run
`bun run api:generate`, then call the API through the typed client. Never hand-edit
`shared/openapi.json` or `src/shared/api/schema.d.ts`.

| Endpoint                                         | Purpose                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `GET /api/agents`                                | `q`, `chain`, `env`, `sort`, `order`, `page`, `pageSize`, `ratedOnly`, `ids` |
| `GET /api/agents/{chainId}/{tokenId}`            | Indexed identity, metadata, feedback and tag scales                          |
| `GET /api/agents/{chainId}/{tokenId}/reputation` | Published `rep-1.0` report + canonical `contentHash`                         |
| `GET /api/networks`                              | Every chain plus cursor health                                               |
| `GET /api/networks/{chainId}/stats`              | Agents, rated agents, feedback and 30-day activity                           |
| `GET /api/reputation/spec`                       | Versioned formula, parameters, kinds and steps                               |

`sort` is `registered`, `score`, `feedback` or `tokenId`; score sorting always puts unrated rows
last. `ids` is a comma-separated `chainId:tokenId` batch for pinned rows.

## Indexer

`server/indexer/` reads Identity and Reputation events, waits for per-chain confirmations, verifies
the previous block hash before advancing and rewinds on a reorg. Metadata work is an SSRF-guarded
worker; scoring materializes chain-wide tag scales and per-agent reports.

```sh
bun run db:migrate        # apply server/db/migrations/*.sql
bun run indexer           # poll every INDEXER_POLL_MS
bun run indexer:once      # one pass, useful for backfill/cron
bun run verify:erc8004    # probe live topic0 hashes on Base and Sepolia
```

Environment: `DATABASE_URL`, optional `INDEXER_CHAINS`, `INDEXER_POLL_MS` and
`INDEXER_RPC_URL_<chainId>` overrides.

## Reputation

The published specification is [`docs/reputation-spec-v1.md`](docs/reputation-spec-v1.md) and
[ADR 0006](docs/adr/0006-onchain-indexer-and-independent-reputation.md). The implementation is
`shared/reputation/`; the indexer and the browser run the same code:

- ratings only; telemetry, outcomes, metrics and unknown tags never enter the score;
- self-reviews from owner or agent wallet are excluded;
- one vote per wallet per tag per 30 days, capped at one full wallet vote;
- 90-day half-life decay and a neutral prior of three wallets;
- an 80% credible interval, confidence tiers and cost-to-fake.

## Architecture

Strict Feature-Sliced Design: `shared → entities → features → widgets → pages → app`. Imports go
downward only and cross-slice imports go through a slice `index.ts`; the PR diagram reads relative
imports. `bun run fsd` fails on a warning. Server code never enters `src/`; shared types and math
live in `shared/`.

Tests are colocated (`*.test.ts(x)`); stories live in `stories/`; Playwright specs live next to
their page. Coverage floors only move up.

## Scripts

```sh
bun run validate         # typecheck, lint, format, fsd, dead-code, duplicates, api:check, build, coverage
bun run check:static     # static checks only
bun run api:generate     # shared/openapi.json + typed client from Zod
bun run test:unit        # vitest
bun run test:coverage    # vitest with floors
bun run test:e2e         # playwright
bun run test:mutate      # stryker on the maintained core (rep-1.0, indexer, db)
bun run coverage:ratchet # raise floors to measured coverage
bun run db:migrate       # PostgreSQL migrations
bun run indexer          # event indexer, metadata worker and scorer
```

Commits follow Conventional Commits; pre-commit runs gitleaks plus `bun run validate`.
