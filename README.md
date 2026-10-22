# 8004rep

Simple read-only explorer for [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) agents, inspired by
[8004scan](https://8004scan.io). A static single-page app: no backend, no wallet, no keys.

- Browse the agents registered on a network, newest first
- Open an agent: owner, agent wallet, registration file, services and reputation cards
- Open a reviewer: stats cards and its latest reviews
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

## Deployment

Deploys run on Vercel through GitHub Actions:

- `Deploy production` — on every push to `main` or `master`: typechecks, tests, builds, then deploys to production.
- `Deploy preview` — on every pull request: typechecks, tests, builds, deploys a preview, and comments its URL on the PR.

The `api/fetch-json.ts` CORS relay is deployed as a Vercel function.

Set these repository secrets before the first run:

| Secret | Where to find it |
|---|---|
| `VERCEL_TOKEN` | Create one at <https://vercel.com/account/tokens> |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link`, or the Vercel project settings |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link`, or the Vercel project settings |

To create the token:

1. Open <https://vercel.com/account/tokens>.
2. Choose **Create Token**, give it a name such as `8004rep GitHub Actions`, pick an expiration, and copy the value once.
3. Run `vercel link` in the repo, then read the two IDs from `.vercel/project.json`.
4. Add the three values under **Settings → Secrets and variables → Actions → New repository secret**, or with the CLI:

```bash
gh secret set VERCEL_TOKEN
gh secret set VERCEL_ORG_ID
gh secret set VERCEL_PROJECT_ID
```

`.env.example` lists the same variables for reference. Production deployments also require a `production` environment in the repository settings (the workflow uses it for the deployment URL).

## Views

| View | Path | Shows |
|---|---|---|
| Agents | `#/agents/:slug` | Agents registered on a network, newest first; search by token ID everywhere, by name on indexed networks |
| Agent | `#/agents/:slug/:id` | One agent: owner, agent wallet, registration file, services and reputation cards |
| Network | `#/network/:slug` | Network feedback health: stats cards and latest reviews |
| Owner | `#/owners/:slug/:address` | All agents owned by an address |
| Reviewer | `#/reviewers/:slug/:address` | One reviewer's stats cards and latest reviews |

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
src/pages/             agent list, agent detail, network, owner, reviewer
src/components/        row, avatar, network picker, source badge, reputation cards
```

`PLAN.md` holds the design notes.
