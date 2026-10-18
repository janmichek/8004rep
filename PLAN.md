# 8004-check — simple 8004scan-inspired ERC-8004 explorer

## Context

`/Users/yeahboi/DEV/8004-web3-agent-chat` ("8004-chat") is heavy: Hono API, LangChain agents, MCP server, Web3Auth, wallets, private keys, IPFS pinning. It only *links out* to 8004scan to look at agents.

`8004-check` is the opposite: a **read-only, backend-less static SPA** that browses ERC-8004 agents the way 8004scan does. No wallet, no keys, no server, no LLM. Open it, pick a chain, see agents, open one, see its identity, services and reputation.

Repo today is an empty scaffold (`index.js` with one `console.log`, stub `package.json`, no commits).

**Decisions confirmed with user**

| Topic | Choice |
|---|---|
| Scope | Read-only, no backend |
| Stack | Vue 3 + Vite + TypeScript (same as chat frontend) |
| Data | Subgraph where one works, RPC otherwise |
| Chains v1 | Arbitrum Sepolia, Ethereum Sepolia, Base Sepolia, Mantle (+ Mantle Sepolia, free to add — same code path, chat 8004rep uses it) |

**First execution step: save a copy of this plan as `PLAN.md` in the repo root** (user asked for the plan in root; plan mode could not write there).

## Facts verified during planning (2026-10-04)

Registry addresses (from `@blockbyvlog/agent0-sdk@1.5.6` `dist/core/contracts.js`, Mantle confirmed by `eth_getCode`):

| Family | Identity | Reputation |
|---|---|---|
| Testnets (421614, 11155111, 84532, 5003) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| Mainnets (5000 Mantle) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

Per-chain data source reality:

| Chain | id | Subgraph | Result |
|---|---|---|---|
| Base Sepolia | 84532 | gateway `…/4yYAvQLFjBhBtdRCY7eUWo181VNoTSLLFd5M7FXQAi6u` | 200, fresh |
| Ethereum Sepolia | 11155111 | gateway `…/6wQRC7geo9XYAhckfmfo8kbMRLeWU8KQd3XsJqFKmZLT` | 200, newest agent dated Mar 2026 — possibly lagging |
| Arbitrum Sepolia | 421614 | studio `…/erc-8004-arbitrum-testnet/version/latest` | **409 "indexing is unavailable"** → RPC |
| Mantle | 5000 | none | RPC |
| Mantle Sepolia | 5003 | none | RPC |

Other verified facts that shape the design:

- Subgraph gateways and all public RPCs return `access-control-allow-origin: *` → browser can call them directly, no proxy.
- Token IDs are **sequential from 0** and `ownerOf(id)` reverts (`0x7e273289` = `ERC721NonexistentToken`) past the end (ids 0/1/50 exist, 500 reverts on Arb Sepolia, Mantle, Mantle Sepolia). So the agent count is found by binary search over `ownerOf` — **no `eth_getLogs` scanning needed** for listing.
- Subgraph `registrationFile` is often `null` and `agentURI` comes as `ipfs://…`, `data:application/json;base64,…`, `https://…` or `null` → metadata must be resolved client-side on both paths.

Consequence: RPC is not a rare fallback, it is the primary path for 3 of 5 chains. Both sources sit behind one interface.

## Architecture

```
            pages (AgentsPage, AgentPage)
                        │
                 data/index.ts  ── sourceFor(chainId): tries subgraph, falls back to rpc
                 ┌──────┴──────┐
        data/subgraph.ts   data/rpc.ts        ← both implement DataSource
                 └──────┬──────┘
                data/metadata.ts              ← resolves agentURI → RegistrationFile
                        │
                    chains.ts                 ← single source of chain facts
```

### File layout (all new unless noted)

```
PLAN.md                       copy of this plan
package.json                  REWRITE (currently stub)
index.js                      DELETE (placeholder)
.gitignore                    node_modules, dist, .env*
index.html
vite.config.ts
tsconfig.json  tsconfig.8004rep.json  tsconfig.node.json
src/main.ts
src/App.vue                   shell: header, chain select, <RouterView>
src/router.ts
src/style.css
src/chains.ts
src/abi.ts
src/format.ts
src/data/types.ts
src/data/metadata.ts          + metadata.test.ts
src/data/rpc.ts               + rpc.test.ts
src/data/subgraph.ts          + subgraph.test.ts
src/data/index.ts
src/pages/AgentsPage.vue
src/pages/AgentPage.vue
src/components/ChainSelect.vue
src/components/AgentRow.vue
src/components/FeedbackList.vue
src/components/SourceBadge.vue
```

### Dependencies

Runtime: `vue`, `vue-router`, `viem`. Dev: `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`, `vitest`. Pin to the majors the chat repo already uses (vue ^3.5, viem ^2.56, vite ^8, plugin-vue ^6, typescript ^6, vue-tsc ^3, vitest ^5), Node 22 (`.nvmrc`).

Deliberately **not** used: `@blockbyvlog/agent0-sdk` (drags ethers + IPFS + signer code for what is ~3 fetches and ~6 view calls), `graphql` client libs (plain `fetch`), wagmi/Web3Auth (no wallet), Tailwind (one small CSS file).

Scripts: `dev`, `build` (`vue-tsc -b && vite build`), `preview`, `typecheck`, `test` (`vitest run`).

### `src/chains.ts`

Port the shape of `8004-web3-agent-chat/frontend/src/networks.ts` (`NetworkInfo`, `findNetwork`, `chainIdOfAgentId`, `addressExplorerUrl`, `txExplorerUrl`) and extend each entry:

```ts
type ChainInfo = {
  chainId: number
  name: string; shortName: string
  slug: string                 // route segment, same as 8004scan scanSlug
  testnet: boolean
  explorerUrl: string
  scanUrl: string              // https://testnet.8004scan.io | https://8004scan.io
  rpcUrl: string               // public, CORS-enabled
  viemChain: Chain             // from viem/chains
  identity: Address
  reputation: Address
  subgraphUrl?: string         // absent → RPC only
}
```

Entries: `arbitrum-sepolia` 421614 (default), `sepolia` 11155111, `base-sepolia` 84532, `mantle` 5000, `mantle-sepolia` 5003. RPC URLs and slugs come from the chat repo's `networks.ts`; Base Sepolia uses `https://sepolia.base.org`.

Overrides via Vite env, read once in `chains.ts`: `VITE_RPC_URL_<chainId>`, `VITE_SUBGRAPH_URL_<chainId>`. The subgraph gateway URLs embed API keys published inside the agent0 SDK — third-party, may be rotated or rate-limited; override + RPC fallback covers that. Arbitrum Sepolia keeps its subgraph URL configured so it self-heals if the studio deployment comes back.

### `src/abi.ts`

Minimal `as const` fragments copied from the SDK's `contracts.js`:
- Identity: `ownerOf(uint256)`, `tokenURI(uint256)`, `getAgentWallet(uint256)`.
- Reputation: `getClients(uint256)`, `getSummary(uint256,address[],string,string)`, `readAllFeedback(uint256,address[],string,string,bool)`.

### `src/data/types.ts`

```ts
type AgentSummary = {
  chainId: number; tokenId: bigint
  owner: Address | null
  agentURI: string | null
  createdAt?: number           // subgraph only
  totalFeedback?: number       // subgraph only
  file?: RegistrationFile | null   // undefined = not resolved yet, null = unresolvable
}
type AgentDetail = AgentSummary & { agentWallet: Address | null; reputation: ReputationSummary | null }
type RegistrationFile = {
  name?: string; description?: string; image?: string
  active?: boolean; x402Support?: boolean
  services: { name: string; endpoint: string; version?: string }[]
  supportedTrust: string[]
  raw: unknown
}
type Feedback = { client: Address; index?: number; value: number; tag1?: string; tag2?: string; endpoint?: string; revoked: boolean; createdAt?: number }
type ReputationSummary = { count: number; average: number }
type Page<T> = { items: T[]; total?: number; hasMore: boolean }

interface DataSource {
  kind: 'subgraph' | 'rpc'
  listAgents(o: { page: number; pageSize: number; search?: string }): Promise<Page<AgentSummary>>
  getAgent(tokenId: bigint): Promise<AgentDetail | null>
  getFeedback(tokenId: bigint): Promise<Feedback[]>
  health(): Promise<{ ok: boolean; lagBlocks?: number; note?: string }>
}
```

### `src/data/metadata.ts` (pure, tested first)

- `resolveAgentURI(uri)`:
  - `data:application/json;base64,` / `data:application/json,` → decode locally.
  - `ipfs://<cid>/path` → try gateways in order (`ipfs.io`, `dweb.link`, `w3s.link`) with `AbortSignal.timeout(8000)` each.
  - `https://` → fetch with timeout; CORS/network failure → `null` (UI shows "metadata unreachable" + raw URI).
  - `null`/empty/other scheme → `null`.
- `normalizeRegistrationFile(json)`: accept current `services[]` (`name`/`endpoint`/`version`) and legacy `endpoints[]` (`type`/`value`/`meta.version`); `x402Support` or `x402support`; `supportedTrust` or `trustModels`. Everything optional, never throws.
- `toDisplayUrl(u)`: `ipfs://` → gateway URL; allow only `https:`, `http:`, `ipfs:`, `data:image/*`; anything else → `undefined`.
- In-memory `Map<uri, Promise<RegistrationFile|null>>` cache (ipfs content is immutable; session-lifetime is enough).

Registration files are **untrusted input**: render with text interpolation only (no `v-html`), pass every image/link through `toDisplayUrl`, external links get `rel="noopener noreferrer"`.

### `src/data/rpc.ts`

`createPublicClient({ chain, transport: http(rpcUrl), batch: { multicall: true } })` — viem auto-aggregates reads through Multicall3 where the chain defines it and degrades to single calls otherwise.

- `agentCount()`: exponential probe (`ownerOf(1), 2, 4, …` until revert) then binary search; ~2·log2(n) calls. Cache per chain; re-probes start from the cached value. Treat only contract reverts as "does not exist" — a transport error must propagate, not be read as end-of-list.
- `listAgents({page,pageSize})`: ids `count-1 … ` descending (newest first), `Promise.all` of `ownerOf` + `tokenURI` per id (batched), `total = count`. Metadata resolved lazily by the page, per row.
- `search`: RPC has no index. Numeric input → jump to that token id. Text → not supported; `listAgents` ignores it and UI says "name search needs an indexed chain".
- `getAgent(id)`: `ownerOf`, `tokenURI`, `getAgentWallet` (revert → `null` for each), then `getClients` → if non-empty `getSummary(id, clients, '', '')`; `average = Number(summaryValue) / 10**decimals`.
- `getFeedback(id)`: `getClients` → `readAllFeedback(id, clients, '', '', true)` → zip the parallel arrays; `value = Number(v) / 10**decimals`. No timestamps on this path.
- `health()`: `getBlockNumber()` succeeds → ok.

### `src/data/subgraph.ts`

`gql(url, query, variables)` = `fetch` POST; throws on non-200 **or** on a body with `errors` (the Arb Sepolia failure is a 409 with an `errors` body).

- `listAgents`: the SDK's `SearchAgentsV2` query shape (`agents(where, first, skip, orderBy: createdAt, orderDirection: desc)` with `registrationFile { name description image active x402Support mcpEndpoint a2aEndpoint webEndpoint supportedTrusts }`). Fetch `pageSize + 1` to compute `hasMore`. Text search → `where: { registrationFile_: { name_contains_nocase: q } }`; numeric search → `where: { agentId: q }`.
- `getAgent`: `agent(id: "<chainId>:<tokenId>")`; `agentWallet` from the subgraph; reputation computed from feedback rows.
- `getFeedback`: `feedbacks(where: { agent: id }, orderBy: createdAt, orderDirection: desc, first: 100)` → `clientAddress value tag1 tag2 endpoint isRevoked createdAt`.
- If `registrationFile` is null but `agentURI` is set → leave `file` undefined so the page resolves it through `metadata.ts` (same as RPC path).
- `health()`: `{ _meta { block { number } } }` compared with RPC head → `lagBlocks`.

### `src/data/index.ts`

`sourceFor(chainId)`: no `subgraphUrl` → rpc. Otherwise run `health()` once per chain per session; failure → rpc (remember the decision, expose the reason). Returns the `DataSource`; pages never branch on `kind` except to render `SourceBadge` and the search hint.

### Routing and pages

`createWebHashHistory` (static hosting with zero rewrite config). Paths mirror 8004scan:

- `/` → redirect `/agents/arbitrum-sepolia`
- `/agents/:slug` → `AgentsPage` (`?page=`, `?q=`)
- `/agents/:slug/:id` → `AgentPage`
- unknown slug → not-found view listing the supported chains

**AgentsPage** — table, newest first: avatar, name (fallback `Agent #id`), `#id`, owner (short, links to block explorer), service chips (MCP / A2A / web / x402), feedback count and created date when the source provides them. Search box, prev/next pagination, page size 25. Rows render immediately from on-chain data; names/avatars fill in as metadata resolves (skeleton state per row, so one slow IPFS fetch never blocks the list).

**AgentPage** — header (avatar, name, `chainId:tokenId`, active / x402 badges); description; identity block (owner, agent wallet, agentURI, registry address — each linked to the block explorer); services table; reputation summary (count, average) + `FeedbackList` (client, value, tags, endpoint, revoked, date if known); collapsible raw registration JSON; "View on 8004scan" link built like `getAgentScanUrl` in the chat repo's `src/core/config.ts`.

**App shell** — title, `ChainSelect` (switching keeps the current page type), `SourceBadge`: `subgraph` / `subgraph · N blocks behind` / `rpc (subgraph unavailable)`.

States on every async view: loading, empty, error with retry. No global store — each page owns its refs; a small `useAsync` composable inside the page file is enough.

`src/format.ts`: `shortAddress`, `formatDate(unixSeconds)`, `formatScore`.

Styling: one `style.css`, CSS variables, dark, dense table — 8004scan-like, no UI framework.

## Build order

1. Copy this plan to `PLAN.md`. Remove `index.js`, write real `package.json`, `.gitignore`, `.nvmrc`, Vite + TS config, `index.html`, empty `App.vue`; `npm install`; `npm run dev` serves a blank shell.
2. `chains.ts`, `abi.ts`, `format.ts`, `data/types.ts`.
3. `metadata.ts` test-first: data-URI decode, ipfs gateway fallback (mock `fetch`), legacy `endpoints` vs `services`, hostile input (`javascript:` URL, non-object JSON, missing fields).
4. `rpc.ts` test-first for `agentCount` against a fake `ownerOf` (counts 0, 1, 51, power-of-two edges; transport error propagates). Then list / detail / feedback.
5. `subgraph.ts`: test `gql` error handling (409 body, `errors` array) and row mapping from a captured fixture; then queries.
6. `data/index.ts` fallback selection (test: unhealthy subgraph → rpc).
7. Router + `AgentsPage` + `AgentRow` + `ChainSelect` + `SourceBadge`.
8. `AgentPage` + `FeedbackList`.
9. Styling pass, README (run instructions, env overrides, data-source table).

## Verification

- `npm run typecheck` and `npm test` pass.
- `npm run build` produces `dist/`; `npm run preview` works from the static bundle.
- In browser (`npm run dev`, Chrome), per chain:
  - **Base Sepolia** — badge `subgraph`; list paginates; name search returns matches.
  - **Ethereum Sepolia** — badge `subgraph`, lag shown if behind.
  - **Arbitrum Sepolia** — badge `rpc (subgraph unavailable)`; list shows newest ids first; total matches binary-search count.
  - **Mantle**, **Mantle Sepolia** — badge `rpc`; ids 0, 1, 50 open; id 500 shows not-found, not a crash.
- Cross-check one agent created by the chat 8004rep (`8004-web3-agent-chat/agents/agent005/agent-config.json` holds its id) against `https://testnet.8004scan.io/agents/arbitrum-sepolia/<id>`: name, owner, agent wallet, services, feedback count agree.
- Fallback drill: set `VITE_SUBGRAPH_URL_84532` to a dead URL → Base Sepolia still lists via RPC with the fallback badge.
- Console clean: no CORS errors, no unhandled rejections when an IPFS gateway times out.

## Out of scope for v1

Wallet connect and giving feedback, validation registry, cross-chain "all agents" view, text search on RPC-only chains, charts/statistics, own indexer or backend, deployment setup.

## Implementation notes (what changed while building)

- **Ethereum Sepolia subgraph is ~213 days stale.** `resolveSource` now also falls back to RPC when the subgraph is more than a day behind, so Base Sepolia is the only network on a subgraph today.
- **Lag is measured in time, not blocks:** `_meta.block.timestamp` against the clock; no extra RPC call. `DataSource.health()` was dropped — `SubgraphSource.meta()` plus `resolveSource` cover it.
- **`getFeedback` merged into `getAgent`:** `AgentDetail` carries `feedback[]`, one call per detail page. `DataSource` gained `supportsTextSearch`.
- **IPFS gateways:** `ipfs.io` / `dweb.link` answer 429 and `w3s.link` only redirects. Order is now Filebase, Pinata, ipfs.io, dweb.link; the gateway that answered last is tried first; at most 6 metadata fetches run at once.
- **RPC count hint is kept in `localStorage`** so a return visit needs 2 probes instead of a full search.
- **TypeScript pinned to 6:** `vue-tsc` 3 does not run on TypeScript 7.
- One `tsconfig.json` instead of three; `useAsync` and `AgentAvatar` are their own files; the chain picker always lands on the new chain's list (token IDs are per chain).
- Not done: the `VITE_SUBGRAPH_URL_84532` dead-URL drill. The same path is exercised live by Arbitrum Sepolia (409) and Ethereum Sepolia (stale), and by unit tests.
