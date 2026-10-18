# 8004-check — feedback display

## Context

The explorer shows feedback only as a bare table at the bottom of one agent's page. There is no way to see what is happening across a network, what a given address has been rating, or which agents in the list have any reputation at all (the list's Feedback column is blank on 4 of 5 networks).

This adds three things:

1. **Score in the agents list** — feedback count and average per row, on every network.
2. **Network feedback feed** — a page with the latest feedback across all agents of a network.
3. **Feedback by reviewer** — the same feed filtered to one client address.

And closes a data gap: on RPC-read networks feedback has no date, endpoint or comment, because those exist only in `NewFeedback` event logs. Chosen approach: **bounded log scan** — read a recent block window sized to each RPC's limit, "Load older" extends it on demand.

**First execution step: save a copy of this plan as `PLAN-feedback.md` in the repo root** (next to `PLAN.md`).

## Facts verified (2026-10-04)

Subgraph (`Feedback` entity, Base Sepolia): `feedbackIndex clientAddress value tag1 tag2 endpoint feedbackURI isRevoked createdAt revokedAt feedbackFile{text …} responses agent{agentId registrationFile{name image}}`. Cross-agent `feedbacks(orderBy: createdAt)` works. `Agent` has `totalFeedback` but **no average score**. No tx hash.

`eth_getLogs` limits on public RPCs (reputation registry, `NewFeedback`):

| Network | RPC | Max range | ≈ time per request |
|---|---|---|---|
| Arbitrum Sepolia | `sepolia-rollup.arbitrum.io` | 10,000,000 | 29 days (124 logs, 0.5 s) |
| Ethereum Sepolia | `ethereum-sepolia-rpc.publicnode.com` | 50,000 | 7 days |
| Mantle | `rpc.mantle.xyz` | 10,000 | 5.5 h |
| Mantle | `mantle-rpc.publicnode.com` | 50,000 | 28 h |
| Mantle Sepolia | `rpc.sepolia.mantle.xyz` | 10,000 | 5.5 h (drpc same, thirdweb 1,000) |
| Base Sepolia | `sepolia.base.org` | 1,000 | 33 min (uses subgraph anyway) |

- Arbitrum Sepolia logs carry `blockTimestamp: 0` → the date must come from `getBlock`.
- `agentId` and `clientAddress` are indexed topics → per-agent and per-reviewer filters are done by the node.
- Feedback values are **not** always 0–100 (seen: `-50`, `1143`); `feedbackURI` is `data:`, `https:` or empty, and `feedbackFile` in the subgraph is usually null → comments must be resolved client-side.

Consequence: on Mantle Sepolia the feed can only reach back ~2 days per step. The UI must say how far it looked, not pretend the feed is complete.

## Design

### Data model — `src/data/types.ts`

```ts
type Feedback = {            // existing, extended
  client: Address
  index?: number             // NEW: feedbackIndex; (client, index) identifies a row per agent
  value: number
  tag1?: string; tag2?: string; endpoint?: string
  revoked: boolean
  createdAt?: number
  feedbackURI?: string       // NEW
  txHash?: Hex               // NEW, log scan only
}
type FeedbackEvent = Feedback & { tokenId: bigint; agentName?: string }   // NEW: a feed row

type FeedbackQuery = { client?: Address; agent?: bigint; cursor?: string }
type FeedbackPage = {
  items: FeedbackEvent[]     // newest first
  cursor?: string            // opaque; absent = nothing older
  since?: number             // unix seconds the scan reached (log scan only)
}

interface DataSource {       // one method added
  listFeedback(query: FeedbackQuery): Promise<FeedbackPage>
}
```

One append-style "Load older" model for both sources — the cursor is a skip count for the subgraph and a block number for RPC, opaque to the UI.

### Log scan — new `src/data/feedbackLogs.ts`

- `scanWindows(toBlock, range, chunks, floor)` — **pure**: returns up to `chunks` consecutive `[from, to]` windows ending at `toBlock`, never below `floor`.
- `scanFeedback(client, chain, { agent?, client?, cursor? })`:
  1. `to = cursor ?? head`; windows = `scanWindows(to, chain.logRange, SCAN_CHUNKS = 8, chain.reputationFromBlock ?? 0n)`.
  2. `getLogs({ address: chain.reputation, event: NewFeedback, args: { agentId, clientAddress }, fromBlock, toBlock })` per window, at most 4 in flight.
  3. Map logs → `FeedbackEvent` (`value / 10**valueDecimals`, `txHash`, `feedbackURI`, `endpoint`), newest first.
  4. Dates: use `log.blockTimestamp` when non-zero, else `getBlock` for the distinct block numbers (cached in a `Map`).
  5. Return `cursor = lowestFrom - 1` unless the floor was reached; `since` = timestamp of the oldest scanned block.
- Revocations: also fetch `FeedbackRevoked` in the same windows and mark matching `(agent, client, index)` rows. A revocation newer than the window of its feedback is still caught while both are inside scanned history; older ones are not — acceptable for a feed, exact state stays on the agent page via `readAllFeedback`.
- `NewFeedback` / `FeedbackRevoked` event fragments added to `src/abi.ts`.

`src/chains.ts`: add `logRange: bigint` per chain (table above), optional `logsRpcUrl` (Mantle → publicnode, 50k; **only if** it sends CORS headers — verify first, else stay on 10k) and optional `reputationFromBlock` (look up each registry's creation block on the block explorer; without it "Load older" just keeps going until block 0).

### Sources

**`src/data/rpc.ts`**
- `zipFeedback` keeps `index` (currently dropped).
- `listFeedback` → `scanFeedback`.
- `getAgent`: after `readAllFeedback`, run one `scanFeedback({ agent })` step and merge by `(client, index)` to fill `createdAt` / `endpoint` / `feedbackURI` / `txHash` on rows found there. Rows older than the window stay bare. Scan failure must not fail the page (catch → bare rows).
- New exported `getScores(client, chain, tokenIds): Promise<Map<bigint, ReputationSummary>>` — one multicall of `getClients`, then one of `getSummary` for agents that have clients. Two requests per list page.

**`src/data/subgraph.ts`**
- `listFeedback`: `feedbacks(where, first: 25, skip, orderBy: createdAt, orderDirection: desc)` with `where = { clientAddress?, agent? }`, selecting the fields listed above plus `agent { agentId registrationFile { name } }`; `cursor = skip + 25` when a 26th row exists.
- `getAgent`: add `feedbackIndex feedbackURI` to the existing feedback selection.

**Scores are always read over RPC** (`getScores`), whichever source lists the agents: the contract is the source of truth, the subgraph has no average, and it keeps one code path. `sourceFor` (`src/data/index.ts`) additionally returns the chain's RPC client so pages can call it.

### Comments — `src/data/metadata.ts`

Split the existing loader: export `fetchJsonUri(uri)` (the current cached, concurrency-limited `load` for `data:` / `ipfs://` / `https://`), keep `resolveAgentURI` on top of it. Add `resolveFeedbackText(uri)` → `text ?? comment` of the feedback file when it is a string, else undefined. Same untrusted-input rule as registration files: text interpolation only.

### UI

- **Header nav** (`src/App.vue`): `Agents | Feedback` tabs next to the brand, keeping the current network.
- **Route** (`src/router.ts`): `/feedback/:slug` → `FeedbackPage`, optional `?client=0x…`.
- **`src/pages/FeedbackPage.vue`** (new):
  - Title "Feedback · <network>"; with `client`: "Feedback by 0x1234…abcd" + block-explorer link + "clear filter".
  - Address input to jump to a reviewer (validated with viem `isAddress`).
  - Table via the shared `FeedbackList`; "Load older" appends the next page.
  - Log-scan networks: line "Scanned back to <date>." Empty window → "No feedback since <date>" with "Load older" still offered. Subgraph: no such line.
  - Invalid `client` param → message, no request.
- **`src/components/FeedbackList.vue`** (extend, used by both pages):
  - Optional **Agent** column (`showAgent`): `agentName ?? Agent #id`, links to the agent page.
  - **Client** links to `/feedback/:slug?client=…` instead of the block explorer.
  - Value, tags, endpoint, date as now; revoked rows dimmed.
  - **Comment**: second line under the row, resolved lazily from `feedbackURI`; nothing shown when absent or unreachable.
  - Date links to the tx on the block explorer when `txHash` is known.
- **`src/pages/AgentPage.vue`**: no layout change; rows gain dates/comments where the scan found them, plus one line when applicable: "Dates shown for feedback since <date>".
- **Agents list** (`src/pages/AgentsPage.vue`, `src/components/AgentRow.vue`): after the list renders, `getScores` for the visible ids; the Feedback column becomes `12 · avg 87.5`, `0`, or `—` while loading / on failure. Column header tooltip: "Count and average of all feedback values, any tag". Never blocks or fails the list.
- `src/format.ts`: reuse `formatScore`, `formatDate`, `shortAddress`.

### Edge cases

- Scan RPC error or 429 on one window → surface "Could not load feedback: …" with Retry on the feed; partial results are not shown as if complete.
- Agent with very many clients: `getSummary` calldata grows with the client list → cap at the first 200 clients and mark the row `≥`.
- Values outside 0–100 and negatives render as-is via `formatScore`.
- `client` filter is lower-cased for the subgraph (it stores lowercase bytes), checksummed for RPC topics.

## Build order

1. Save `PLAN-feedback.md`. Extend types; `abi.ts` events; `chains.ts` `logRange` (+ verify Mantle publicnode CORS, look up registry creation blocks).
2. `feedbackLogs.ts` test-first: `scanWindows` (floor, single chunk, exact fit, head smaller than range), log → `FeedbackEvent` mapping incl. decimals and negatives, revocation marking, merge by `(client, index)`.
3. `rpc.ts`: keep `index`, `listFeedback`, `getAgent` merge, `getScores` (test with a fake client: empty clients skip `getSummary`; cap at 200).
4. `subgraph.ts`: `listFeedback` + mapping test from a captured row; cursor logic.
5. `metadata.ts`: `fetchJsonUri` split, `resolveFeedbackText` tests (data URI with `comment`, with `text`, non-object, unreachable).
6. `FeedbackList` extension, `FeedbackPage`, route, header nav.
7. Scores in `AgentsPage` / `AgentRow`.
8. README: feed, reviewer filter, per-network scan reach table.

## Verification

- `npm test`, `npm run typecheck`, `npm run build` pass.
- Headless Chromium (same Playwright approach as before) or Chrome if connected:
  - **Base Sepolia** `#/feedback/base-sepolia`: 25 rows with agent names, dates, comments where the URI resolves; "Load older" appends 25 more; clicking a client filters to that reviewer.
  - **Arbitrum Sepolia** `#/feedback/arbitrum-sepolia`: rows with real dates (via `getBlock`), "Scanned back to …" line; `?client=0x928607eFdFCF7D14FA08A1E92e551C47201dbf0F` shows that address's feedback only.
  - **Ethereum Sepolia / Mantle / Mantle Sepolia**: empty-window message with date and working "Load older"; no crash, no unbounded request burst (≤ 8 `getLogs` per step).
  - **Agents list** on every network: Feedback column fills in; Arbitrum Sepolia agent #221 shows `1 · avg 100`.
  - **Agent page** `#/agents/arbitrum-sepolia/221`: the existing row is unchanged if older than the window, dated if inside it.
- Cross-check 3 feed rows on Base Sepolia against the raw subgraph response, and 3 on Arbitrum Sepolia against the tx on Arbiscan.
- Console: no page errors; failed comment fetches do not break rows.

## Out of scope

Giving, revoking or responding to feedback; feedback responses display; proof-of-payment details; score charts or distributions; tag filter; full-history indexing on RPC networks; per-tag averages (e.g. `starred`-only quality rating).
