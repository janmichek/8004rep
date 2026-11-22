# 8004rep — backend offload plan

**Implemented decisions (2026-11-22)**

| Topic | Choice |
|---|---|
| Hosting | Fly.io app `8004scan`, region `fra`, 1 GB volume mounted at `/data` |
| Chains indexed | Base (8453), Ethereum (1), Mantle (5000) |
| Fallback | Unindexed networks and an unreachable indexer keep the 8004scan / browser RPC path |
| Stack | Hono + `node:sqlite` (WAL) on Node 24 — no native modules, no separate database |
| Frontend | `VITE_API_URL` (default `https://8004scan.fly.dev`); `off` disables the index path |

The rest is the original plan, kept verbatim.

---

Here is a detailed, pragmatic plan to add a **simple, single-service backend** that offloads the heavy chain/indexing/scoring work from the frontend and unlocks the next wave of features—without over-engineering.

---

## 1. Why the Frontend Is Overloaded Today

Right now the browser is acting as an indexer, RPC client, IPFS fetcher, block-explorer scraper, and analytics engine all at once:

- **Massive request fan-out per page:**
  - `AgentPage.vue` + `src/data/rpc.ts` / `subgraph.ts` loops up to 5,000 feedback rows (subgraph) or fires 25–50+ RPC calls (`ownerOf`, `tokenURI`, `getAgentWallet`, `getClients`, `getSummary`, `readAllFeedback`, 16 `getLogs` chunks for feedback/revocations, 8 `getLogs` chunks for responses, plus `getBlock` per undated row).
  - `ReviewersTab.vue` (`src/data/reviewerInsights.ts`) then fires another ~48–100+ requests (feedback feed + nonce + 2 explorer calls × top 12 reviewers).
  - `TxDetail.vue` (`src/data/txDetail.ts`) binary-searches up to 48 `getBlock` calls to find a subgraph row's `txHash`, and fetches up to 50 off-chain JSON files (`MAX_COMPARED_FILES`) just to check payment reuse.
  - `OwnersPage.vue`, `ReviewersPage.vue`, `FeedbacksPage.vue` (`useChainLoad` / `useFeedRows`) fan out across every network in parallel, and `OwnerPage.vue` scans `ownerOf` in 1,024-token chunks on RPC chains.
- **No shared cache & repeated CPU work:** Every visitor re-fetches and recomputes `buildReputationReport`, `computeFeedbackStats`, `buildTrustReport`, and O(N²) Jaccard lookalikes (`computeNetworkStats`) from scratch.
- **Browser limits block the best features:**
  - **CORS & secrets:** Chains without CORS-open keyless explorers (Base, BSC, Polygon, Monad, etc. in `src/chains.ts`) cannot trace funding at all.
  - **Bounded windows:** Network health, owners, reviewers, and feeds only reflect small recent samples (e.g., ~250 rows or ~2 days of Mantle logs).
  - **No real leaderboard / history:** `AgentsPage.vue` depends entirely on 8004scan's API and cannot sort/filter by *your* filtered score, inflation gap, or confidence.

---

## 2. Recommended Simple Architecture

### The Core Idea: **One Node.js + TypeScript Service + SQLite**

Don't introduce Redis, Kafka, BullMQ, microservices, or a separate indexer language. Your biggest advantage is that **everything in `src/data/` is already pure Node-compatible TypeScript + `viem`** (it already runs under Vitest's `node` environment).

```
┌──────────────────────────────┐        REST JSON         ┌─────────────────────────────────────────┐
│  Vue SPA (Vercel static)     │ ◄──────────────────────► │  8004rep Backend (1 Node 22 container)  │
│  - 1 request per page        │                          │  - Hono HTTP API                        │
│  - Classic + 21 UI variants  │                          │  - In-process sync + enrichment loops   │
│  - Thin src/data/api.ts      │                          │  - Reuses shared/ scoring & viem logic  │
└──────────────────────────────┘                          │  - SQLite (WAL mode) on local volume    │
                                                          └──────────────┬──────────────────────────┘
                                                                         │ Server-side keys, rate-limited
                                                          ┌──────────────▼──────────────────────────┐
                                                          │ RPCs · Subgraphs · Explorers · IPFS/URL │
                                                          └─────────────────────────────────────────┘
```

### Stack (minimal dependencies, boring & proven)
- **Runtime:** Node 22 (already specified in `package.json`) + TypeScript (`tsx` in dev, `tsc`/bundle in prod).
- **HTTP framework:** **Hono** (`hono` + `@hono/node-server`) — tiny, fast, great TS ergonomics.
- **Database:** **SQLite in WAL mode** (`better-sqlite3` + **Drizzle ORM** for typed schema/migrations).
  - 1 file on disk (`data/8004rep.db`), zero separate DB server to manage, fast reads for millions of rows, easy later migration to Postgres via Drizzle if you ever need multi-instance scaling.
- **Background jobs:** Plain **in-process async loops** (event poller + enrichment worker + score recomputer). No queue broker needed.
- **Hosting:** One cheap stateful box with a persistent disk (**Fly.io**, **Railway**, or a **$5 Hetzner VPS**). Frontend keeps deploying statically on **Vercel** via existing GitHub Actions.

> **Why not Vercel Serverless + Postgres + Cron?**
> Chain log backfills and rate-limited explorer/IPFS enrichment are long-running, stateful loops. Serverless timeouts, cold starts, and connection pooling make an indexer harder on Vercel than on a single $5/mo Node container.

---

## 3. Repository Structure (Low-Churn Monorepo)

Keep one repo so types and scoring code stay 100% in sync without publishing packages:

```
8004rep/
├── shared/                      # Pure TS shared by FE + BE (moved/re-exported from src/data)
│   ├── abi.ts                   # Identity + Reputation ABIs (add Transfer event)
│   ├── chains.ts                # Chain metadata (public fields; server adds private RPC/explorer keys)
│   ├── types.ts                 # Shared domain + API response types
│   └── scoring/                 # Pure logic: reputation/*, feedbackStats, trustReport, reviewerProfile, networkStats, txChecks
├── server/                      # New Node backend (npm workspace or sub-package)
│   ├── package.json
│   ├── src/
│   │   ├── index.ts             # Starts Hono server + background loops + graceful shutdown
│   │   ├── config.ts            # Env vars (RPC keys, explorer keys, enabled chains, DB path)
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle SQLite tables
│   │   │   └── index.ts         # SQLite WAL setup + auto-migrations
│   │   ├── workers/
│   │   │   ├── chainSync.ts     # Incremental log poller (Reputation + Identity Transfer)
│   │   │   ├── enricher.ts      # Metadata URIs, feedback files + hashes, payment txs, wallet funding
│   │   │   ├── scorer.ts        # Recomputes agent_scores & network_snapshots for dirty items
│   │   │   └── httpFetch.ts     # SSRF-safe fetcher (reuses api/fetch-json.ts IP/redirect checks)
│   │   └── routes/
│   │       ├── agents.ts
│   │       ├── feedback.ts
│   │       ├── network.ts
│   │       ├── owners.ts
│   │       ├── reviewers.ts
│   │       └── health.ts
│   └── Dockerfile
└── src/                         # Existing Vue SPA (gradually thinned out to call server API)
```

---

## 4. Database Schema (Simple & Normalized)

Nine small tables cover everything today plus Phase 2/3 features:

1. **`sync_state`**
   - `(chain_id, stream)` PK (`stream` = `'identity'` | `'reputation'`)
   - `last_block`, `head_block`, `updated_at`, `last_error`
2. **`agents`**
   - `(chain_id, token_id)` PK
   - `owner`, `agent_wallet`, `agent_uri`, `created_at`, `created_block`, `updated_at`
   - Cached registration file fields: `name`, `description`, `image`, `active`, `x402`, `services_json`, `supported_trust_json`, `raw_file_json`, `file_fetched_at`, `file_error`
   - `needs_recompute` (boolean flag set whenever feedback/enrichment changes)
3. **`agent_transfers`** *(enables ownership-change carryover)*
   - `(chain_id, tx_hash, log_index)` PK
   - `token_id`, `from_addr`, `to_addr`, `block_number`, `timestamp`
4. **`feedback`**
   - `(chain_id, token_id, client, feedback_index)` PK
   - `value_raw`, `value_decimals`, `value` (scaled float), `tag1`, `tag2`, `endpoint`, `feedback_uri`, `feedback_hash`
   - `revoked` (bool), `revoked_block`, `revoked_tx_hash`
   - `block_number`, `log_index`, `tx_hash`, `created_at`
   - Tx facts (populated lazily or during enrichment): `tx_from`, `tx_to`, `tx_fee_wei`, `tx_feedback_count`
5. **`feedback_responses`**
   - `(chain_id, tx_hash, log_index)` PK
   - `token_id`, `client`, `feedback_index`, `responder`, `response_uri`, `block_number`, `created_at`
6. **`feedback_files`** *(deduped by URI — makes payment reuse a 1ms SQL lookup)*
   - `uri` PK
   - `scheme`, `content_hash`, `canonical_hash`, `comment_text`
   - `payment_tx_hash`, `payment_chain_id`, `payment_verified`, `payment_facts_json`
   - `raw_json`, `fetched_at`, `error`
   - Index on `(payment_chain_id, payment_tx_hash)`!
7. **`wallets`** *(shared across every agent/reviewer/tx check)*
   - `(chain_id, address)` PK
   - `nonce`, `kind` (`'eoa'` | `'delegated'` | `'contract'`)
   - `first_funder`, `funding_tx_hash`, `funding_timestamp`, `funding_value_wei`
   - `funding_root`, `funding_depth`, `funding_path_json` *(for depth-3 tracing & entity merging)*
   - `traced_at`, `trace_error`
8. **`agent_scores`** *(precomputed materialization for instant list sorting & detail pages)*
   - `(chain_id, token_id)` PK
   - `formula_version` (e.g. `'rep-1.0'`)
   - Flat sortable columns: `filtered_score`, `interval_lo`, `interval_hi`, `confidence`, `unrated`, `raw_score`, `raw_ratings`, `inflation_gap`, `cost_to_fake`, `total_feedback`, `rated_rows`, `wallets_count`, `entities_count`, `neff`, `top1`, `risk_level`, `evidence_backed_share`
   - Cached 8004scan comparison: `scan_score`, `scan_json`, `scan_fetched_at`
   - Full payloads: `report_json`, `stats_json`, `trust_report_json`, `computed_at`
   - Indexes on `(chain_id, filtered_score DESC)`, `(chain_id, total_feedback DESC)`, `(chain_id, inflation_gap DESC)`
9. **`network_snapshots`** & **`score_snapshots`** *(precomputed network pages + historical charts)*
   - `network_snapshots`: `(chain_id, window_key)` PK (`'30d'` | `'all'`), `stats_json`, `computed_at`
   - `score_snapshots`: `(chain_id, token_id, day_utc)` PK, `filtered_score`, `raw_score`, `wallets_count`, `feedback_count`

---

## 5. Background Loops (Simple, Resumable, Rate-Limit Friendly)

Three lightweight `while` loops running inside the Node process (each wrapped in `try/catch` + backoff):

### Loop 1 — Chain Sync (`chainSync.ts`, every ~15–30s per enabled chain)
1. Read `last_block` from `sync_state` (defaulting to `reputationFromBlock` or contract deployment block).
2. Walk forward in `logRange` chunks via `viem` `getLogs`:
   - **Reputation Registry:** `NewFeedback`, `FeedbackRevoked`, `ResponseAppended`
   - **Identity Registry:** `Transfer` (mint/transfer → upserts `agents`, logs `agent_transfers`, refreshes `tokenURI` + `getAgentWallet` via Multicall3 for touched token IDs)
3. Attach block timestamps (batching unique block numbers in the chunk).
4. Write logs + updated `last_block` in **one SQLite transaction** (atomic, crash-safe) and set `agents.needs_recompute = 1` for touched agents.
5. *Optional fast-start:* For chains with huge history or a working subgraph, allow an initial one-time backfill script from Subgraph / `readAllFeedback`, then let the log poller tail live blocks.

### Loop 2 — Enrichment Worker (`enricher.ts`, continuous with gentle concurrency)
Picks small batches of un-enriched rows and populates them with server-side rate limits & retries:
1. **Registration files:** `SELECT ... FROM agents WHERE agent_uri IS NOT NULL AND file_fetched_at IS NULL LIMIT 20` → fetch via SSRF-safe `httpFetch` (IPFS gateways + HTTPS, reusing `api/fetch-json.ts` rules + `metadata.ts` normalization) → update `agents`.
2. **Feedback files & payments:** `SELECT DISTINCT feedback_uri FROM feedback WHERE feedback_uri IS NOT NULL AND feedback_uri NOT IN (SELECT uri FROM feedback_files) LIMIT 20` → fetch bytes, compute `keccak256` + `canonicalHash`, extract comment text + `proofOfPayment`, verify payment tx on-chain once → insert into `feedback_files`.
3. **Wallet & funding tracer:** `SELECT ... FROM feedback ...` for wallets missing/stale in `wallets` → read `getTransactionCount` + `getCode` via RPC + trace first funder (depth 1 initially, depth 3 in Phase 4) via server-side keyed explorer API (Etherscan V2 unified API / Blockscout / Routescan). Mark affected agents `needs_recompute = 1`.
4. **8004scan comparison cache:** Refresh `scan_score` every 12–24h for rated agents (low priority).

### Loop 3 — Score & Network Recomputer (`scorer.ts`, every ~5–10s for agents, every ~10m for network)
1. **Agent scores:** Pick up to 50 agents with `needs_recompute = 1`, load their `feedback` + `responses` + `wallets` + `feedback_files`, run the **exact existing** `buildReputationReport()`, `computeFeedbackStats()`, `buildTrustReport()`, and upsert `agent_scores` + clear `needs_recompute`.
2. **Network snapshots:** Periodically aggregate full-chain `computeNetworkStats()` (and daily volume/histograms/lookalikes) into `network_snapshots`.
3. **Daily score snapshots:** Once per UTC day, copy `agent_scores` summary columns into `score_snapshots` for rated agents.

### On-Demand Priority (Best UX while backfilling)
If a user opens an agent or feedback detail whose metadata/tx/wallet hasn't been enriched yet, the route handler can trigger a quick bounded enrichment on-the-fly (deduped by an in-memory `Map<string, Promise>`) so the user doesn't wait for the background queue.

---

## 6. REST API Design (1 Request per Page)

All endpoints return clean JSON (bigints serialized as strings) with `Cache-Control` headers:

| Endpoint | Replaces on FE | Returns |
|---|---|---|
| `GET /api/health` | Subgraph health badge | Sync status per chain (`lastBlock`, `headBlock`, `lagSeconds`, `agentCount`, `feedbackCount`) |
| `GET /api/agents` | `fetchScanAgents` (`AgentsPage`) | Paginated agents across 1 or all chains; query params: `env`, `chainId`, `q` (name/ID/owner), `sort` (`filteredScore`, `rawScore`, `inflationGap`, `feedbackCount`, `createdAt`, `confidence`), `order`, `minConfidence`, `page`, `limit` |
| `GET /api/agents/:chainId/:tokenId` | `source.getAgent` + `resolveAgentURI` + `ReputationPanel` calculations + `fetchScanScore` | Full agent identity, normalized registration file, precomputed `report`, `stats`, `trustReport`, `scanScore`, feedback rows (with pre-extracted comment text & `txHash`) |
| `GET /api/agents/:chainId/:tokenId/reviewers` | `ReviewersTab` + `loadReviewerInsights` + `clusterByFunder` | All reviewers of the agent (not capped to 12!), their cross-agent profiles, nonces, funding paths, shared-funder clusters, and owner-linked flags |
| `GET /api/agents/:chainId/:tokenId/history` | *(New feature)* | Daily `score_snapshots` + `agent_transfers` timeline |
| `GET /api/feedback/:chainId/:tokenId/:client/:index/checks` | `loadTxFacts` + `evaluateTxDetail` (`TxDetail.vue`) | Complete evaluated tx/file/payment/reviewer checks, with **chain-wide** payment-reuse count via SQL instead of fetching 50 files |
| `GET /api/network/:chainId` | `NetworkPage` (`loadFeedWindow` + `computeNetworkStats` + `fetchScanChainFeedback`) | Precomputed totals, 30d activity, daily volume, rating histogram, top agents, suspect reviewers, lookalike rings (`window=30d\|90d\|all`) |
| `GET /api/owners` & `GET /api/owners/:address` | `OwnersPage` & `OwnerPage` (`loadAgentWindow`, `ownedTokenIds`, `getScores`) | True owner directory & full multi-chain owner portfolio with precomputed filtered scores |
| `GET /api/reviewers` & `GET /api/reviewers/:address` | `ReviewersPage` & `ReviewerPage` | Full reviewer directory & cross-chain reviewer profile + wallet/funding info |
| `GET /api/feedbacks` | `FeedbacksPage` (`useFeedRows` + `FeedbackNote`) | Cursor-paginated global/per-chain feedback feed with cached agent names & comment text |

---

## 7. What New Features This Unlocks

Moving indexing + enrichment + scoring to the backend directly unlocks Phase 2 & 3 of `reputation-metrics-plan.md`:

1. **True Filtered-Score Leaderboard:** Rank & filter all agents by *your* `Filtered score`, `Confidence`, `Inflation gap` (raw minus filtered), and `Cost to fake`—no longer dependent on 8004scan's opaque ranking.
2. **Funding Graph & Owner-Linked Detection on Every Chain:** Server-side API keys (e.g., Etherscan V2 + Blockscout) unlock funding traces on Base, Polygon, BSC, Arbitrum, Ethereum, Mantle for *all* reviewers, enabling depth-3 funding roots, INFRA-label filtering (CEX/faucets/bridges), entity merging (`N_ent`), and shared-funder farm detection.
3. **Real Payment-Proof Verification & Global Reuse Detection:** Pre-verify `proofOfPayment` txs, compute agent-wide **Evidence-Backed Share** (L0/L1/L2/L3), detect wash payments, and spot payment tx hashes reused across *different* agents in 1 SQL query.
4. **Full-History Network Health & Collusion Rings:** Lookalike groups, suspect reviewers, and network totals computed over the real dataset instead of a 250-row sliding window.
5. **Ownership-Change Carryover:** From indexed `Transfer` logs, immediately flag what share of an agent's score was earned under a previous owner (and check `self` against the owner *at the feedback block*).
6. **Score History & Endpoint Liveness Probes:** Daily `score_snapshots` power score-over-time charts; a low-frequency backend probe can verify `.well-known` / MCP / A2A liveness without CORS issues.
7. **Instant Upgrade for All 21 UI Variants:** Updating `src/variants/shared/use.ts` automatically speeds up every single design variant.

---

## 8. Step-by-Step Implementation Plan

### Phase 1 — Shared Core + Backend Skeleton + Chain Indexer *(~3–4 days)*
- **1.1 Workspace setup:** Extract pure TS modules (`abi.ts`, chain constants, `types.ts`, `reputation/*`, `feedbackStats.ts`, `trustReport.ts`, `reviewerProfile.ts`, `networkStats.ts`, `txChecks.ts`) into `shared/` (keeping existing `npm test` green).
- **1.2 Scaffold `server/`:** Hono + `@hono/node-server` + `better-sqlite3` + Drizzle schema & migrations + `GET /api/health`.
- **1.3 Chain syncer (`chainSync.ts`):** Index `NewFeedback`, `FeedbackRevoked`, `ResponseAppended`, and `Transfer` on 2–3 initial chains (e.g., Base, Ethereum, Mantle, or your priority testnets/mainnets). Verify resumability across restarts.
- **1.4 First endpoints:** `GET /api/agents` and `GET /api/agents/:chainId/:tokenId` serving indexed on-chain data.

### Phase 2 — Enrichment Worker + Precomputed Scoring + Full API *(~4–5 days)*
- **2.1 SSRF-safe fetcher:** Port `api/fetch-json.ts` IP/redirect protections + `metadata.ts` IPFS/data-URI decoding into `server/src/workers/httpFetch.ts`.
- **2.2 Enricher (`enricher.ts`):**
  - Registration files → `agents`
  - Feedback files + hashes + comment text + payment tx lookup → `feedback_files`
  - Wallet nonce/code + depth-1 first-funder lookup (using server-side explorer keys) → `wallets`
  - Periodic 8004scan comparison cache → `agent_scores`
- **2.3 Scorer (`scorer.ts`):** Compute and persist `agent_scores` on dirty agents + `network_snapshots` periodically.
- **2.4 Remaining endpoints:** `/reviewers`, `/owners`, `/feedbacks`, `/network/:chainId`, `/agents/:chainId/:tokenId/reviewers`, and `/feedback/.../checks` (with SQL-based payment reuse).
- **2.5 Tests:** Unit/integration tests against an in-memory SQLite DB (`:memory:`) verifying sync idempotency, score materialization, and API payloads.

### Phase 3 — Progressive Frontend Migration *(~3–4 days)*
- **3.1 Thin API client:** Add `src/data/api.ts` targeting `VITE_API_URL` (with clean types shared from `shared/`).
- **3.2 Migrate classic pages one by one:**
  1. `AgentsPage.vue` (switch from 8004scan to `/api/agents`, add Filtered Score / Inflation Gap / Confidence sorts)
  2. `AgentPage.vue` + `ReputationPanel.vue` + `ReviewersTab.vue` (1 call for agent + 1 call for reviewers; drop client-side heavy computation and 12-reviewer cap)
  3. `FeedbackDetailPage.vue` + `TxDetail.vue` (call `/checks` endpoint; drop 48-block binary search & 50-file reuse fetch)
  4. `NetworkPage.vue`, `OwnersPage.vue`, `OwnerPage.vue`, `ReviewersPage.vue`, `ReviewerPage.vue`, `FeedbacksPage.vue`
  5. `src/variants/shared/use.ts` (brings all 21 designs onto the backend)
- **3.3 Clean up:** Remove unused client-side log-scanning/funding/CORS-relay code (`api/fetch-json.ts`, `feedbackLogs.ts`, `funding.ts` in browser, etc.)—or keep an optional client fallback only for chains not yet indexed.

### Phase 4 — Backend-Enabled Features *(ongoing, pick in any order)*
- **4.1 Depth-3 funding graph + INFRA labels + Entity merge (`N_ent`)** (Phase 2.1–2.3 of `reputation-metrics-plan.md`).
- **4.2 Agent-level Evidence-Backed Share (L0/L1/L2/L3) & wash-payment checks**.
- **4.3 Ownership-change carryover** (already have `agent_transfers` indexed from Phase 1!).
- **4.4 Daily `score_snapshots` & score-history chart** on the Agent page.
- **4.5 Endpoint liveness checks** (`.well-known`, MCP/A2A probes) + **cross-chain agent linking**.

---

## 9. Deployment & Operations (Keeping It Simple)

- **Environment variables on backend:**
  - `PORT=8787`, `DB_PATH=/data/8004rep.db`, `CORS_ORIGIN=https://your-vercel-app.vercel.app`
  - `ENABLED_CHAINS=8453,1,5000,42161` (start small, add chain IDs anytime)
  - `RPC_URL_<chainId>=...` (can use private Alchemy/QuickNode/Infura keys safely now!)
  - `ETHERSCAN_API_KEY=...` (Etherscan V2 covers Ethereum, Base, Arbitrum, Polygon, BSC, etc. with one key) + optional `EXPLORER_API_URL_<chainId>`
- **Hosting:**
  - `server/Dockerfile` deployed on **Fly.io** (1 shared-cpu machine + 10GB volume, ~$5–7/mo) or **Railway** (1 service + volume).
  - Optional 5-line backup: **Litestream** replicating `8004rep.db` to Cloudflare R2 / S3 (near-free), or simply re-syncable since all source data is on-chain.
- **Frontend:**
  - Stays on Vercel as-is; add `VITE_API_URL=https://api.yourdomain.com` in Vercel env vars.
  - Header source badge shows backend sync status ("Indexed · 12s behind" from `/api/health`).

---

## 10. Quick Decisions Before We Start Implementing

Before writing code, let me know your preferences on these 3 points:
1. **Hosting target:** Are you happy with a single Node + SQLite service (e.g., Railway / Fly.io / VPS), or do you have a hard constraint to stay 100% on Vercel?
2. **Initial chains to index:** Which 2–4 chains should we enable first (e.g., Base + Ethereum + Mantle, or testnets first)?
3. **Fallback behavior:** During migration, should unindexed chains fall back to the existing browser RPC/8004scan path, or should we only show backend-indexed chains?