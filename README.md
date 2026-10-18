# 8004-check

Simple read-only explorer for [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) agents, inspired by
[8004scan](https://8004scan.io). A static single-page 8004rep: no backend, no wallet, no keys.

- Browse the agents registered on a network, newest first
- Open an agent: owner, agent wallet, registration file, services, reputation and feedback
- Open the **Tx detail** of a feedback row: how much backs that one rating, check by check
- Search by token ID everywhere, by name on indexed networks

## Run

```bash
nvm use          # Node 22
npm install
npm run dev      # http://localhost:5174
```

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, then build the static bundle into `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run typecheck` | `vue-tsc` |
| `npm test` | Unit tests (Vitest) |

`dist/` can be hosted anywhere static; routing uses the URL hash, so no rewrite rules are needed.

## Views

| View | Path | Shows |
|---|---|---|
| Agents | `#/agents/:slug` | Agents registered on a network, newest first; search by token ID everywhere, by name on indexed networks |
| Agent | `#/agents/:slug/:id` | One agent: owner, agent wallet, registration file, services, reputation and feedback; each feedback row opens the **Tx detail** |
| Network | `#/network/:slug` | Network feedback health: stats, suspect reviewers, review rings, latest reviews |
| Owner | `#/owners/:slug/:address` | All agents owned by an address |
| Reviewer | `#/reviewers/:slug/:address` | One reviewer's profile: rules that fired, agents they rate, latest reviews |

Tx detail opens as a container on an agent page and answers one question per feedback row: what would it have cost to fake this rating? — transaction, feedback file, cited proof of payment, and the reviewer, one check per line.

## Networks and data sources

| Network | Chain ID | Source |
|---|---|---|
| Arbitrum Sepolia | 421614 | RPC (its subgraph currently answers "indexing unavailable") |
| Ethereum Sepolia | 11155111 | RPC (its subgraph stopped indexing months ago) |
| Base Sepolia | 84532 | Subgraph |
| Mantle | 5000 | RPC (no subgraph) |
| Mantle Sepolia | 5003 | RPC (no subgraph) |

The source is picked at runtime, once per network per session: the subgraph is used when it answers and is less
than a day behind the chain, the registry contracts are read directly otherwise. The badge in the header shows
which one is in use; hover it for the reason. A network switches to its subgraph by itself once that subgraph is
healthy again.

What differs between the two:

| | Subgraph | RPC |
|---|---|---|
| Name search | yes | no, token ID only |
| Created date, feedback count in the list | yes | no |
| Feedback dates and endpoints | yes | no |
| Feedback rows per agent | latest 100 | all |
| Total agent count | no | yes |

Over RPC the agent list needs no log scanning: token IDs are sequential, so the count is found by binary search
on `ownerOf` and each page is one batched Multicall3 request.

Registration files (`ipfs://`, `https://`, `data:` URIs) are fetched by the browser. A file hosted without CORS
headers cannot be read and shows as "metadata unreachable"; the on-chain data is still displayed.

## Tx detail

Every feedback row on an agent page opens a container that asks one question: what would it have cost to fake
this row? It reads the row's transaction, its feedback file, the payment that file cites and the reviewer's
account, then prints one line per check with a status. Hover a line for the rule behind it.

| Group | Checks |
|---|---|
| Transaction | sent by the reviewer (not a relayer, not the agent's owner) · calls the registry directly · one feedback per transaction · fee paid |
| Feedback file | readable · cannot be rewritten (`data:` / IPFS / `feedbackHash` = `keccak256` of the bytes or of their canonical JSON) · restates the on-chain row · names an endpoint, tool, task or skill |
| Proof of payment | cited · exists and did not revert · moves value from the reviewer to the agent's owner or wallet · older than the feedback · not cited by another row · amount |
| Reviewer | not the agent itself · established wallet (nonce) · rates other agents · ratings vary (entropy) · stands by its feedback (revocations) |
| Within this agent | authenticity weight · the reviewer's share of rows · reviewer concentration (Herfindahl index) · not left right after registration · leave-one-out pull on the weighted score |

Statuses: `pass`, `warn`, `fail`, `absent` (the evidence was not offered), `unknown` (it could not be read from
the browser — CORS, a chain that is not configured, a row older than the log scan) and `info` (a measurement, no
verdict). The headline is a band, "6–13 of 14 checks hold": the low end counts the passes, the high end adds the
unknowns.

Rows from a subgraph carry no transaction hash; the detail finds it from the row's date (a few `getBlock` probes,
then one `getLogs` on that window).

Not computed, and why: links between a reviewer and the agent's owner through funding (needs an indexer or a
block-explorer API, an RPC cannot answer "who funded this wallet"), wallet age, ownership transfers and URI
changes after the reputation was earned (full-history log scans), and anything against the Validation Registry
(not deployed yet).

## Configuration

Optional, in `.env.local`:

```bash
VITE_RPC_URL_<chainId>=https://…        # replace a network's public RPC
VITE_SUBGRAPH_URL_<chainId>=https://…   # set or replace a network's subgraph
```

The built-in subgraph URLs are the public defaults shipped in `@blockbyvlog/agent0-sdk`; they may be rate-limited.

Networks live in `src/chains.ts` — adding one is a new entry there.

## Layout

```
src/chains.ts          networks: RPC, registries, subgraph, explorer links
src/abi.ts             the registry functions that are read
src/data/types.ts      DataSource interface and shared types
src/data/rpc.ts        DataSource over the registry contracts (viem)
src/data/subgraph.ts   DataSource over the agent0 subgraph (GraphQL)
src/data/index.ts      picks the source of a network
src/data/metadata.ts   fetches and normalizes registration files
src/data/scores.ts     off-chain scores and authenticity weights over an agent's feedback
src/data/feedbackStats.ts  per-row checks, per-reviewer breakdown, risk signals
src/data/txChecks.ts   rules of the tx detail: facts about one feedback row → checks
src/data/txDetail.ts   reads those facts: transaction, feedback file, cited payment, reviewer
src/pages/             agent list and agent detail
src/components/        row, avatar, feedback table, tx detail, network picker, source badge
```

`PLAN.md` holds the design notes.
