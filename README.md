# 8004rep

Read-only ERC-8004 agent reputation explorer, built on the strict Feature-Sliced React template from `dev-template-2026`.

## Start

You need [Bun](https://bun.sh) and Docker.

```sh
bun install
bun run dev
```

Open http://localhost:3001. One container serves the API and the UI.

Without Docker, run the API and the Vite dev server yourself:

```sh
bun server/index.ts
bun run start
```

The UI is http://localhost:3000 and proxies `/api` to port 3001.

`cp .env.example .env` is only for a Sentry DSN or a Chromatic token. The app runs without them.

## Explorer

| Page     | Route                       | What it shows                                                            |
| -------- | --------------------------- | ------------------------------------------------------------------------ |
| Overview | `/`                         | Network filter, status counts, average score, the three newest agents    |
| Agents   | `/agents` and `/agents/:id` | Same filter and summary, the full roster. The id in the URL opens a row. |

The network filter drives both the summary and the table on that page.

## Architecture

Imports only go downward. Steiger's recommended rules are all on, including `insignificant-slice`, so a slice has to be used from more than one place.

```text
app        router, providers, shell
pages      one screen each: overview, agents
widgets    summary (counts + average score), roster (agent table)
features   filter-network (pick a network)
entities   agent, network
shared     api client, lib helpers, ui kit
```

A slice is imported through its `index.ts`. Cross-slice imports are relative on purpose: the pull-request diagram reads relative imports and draws those arrows. `bun run fsd` fails the build on a warning.

`shared/schemas.ts` is the API contract. Change the Zod schema, run `bun run api:generate`, and call the API through `fetchAgents` or `fetchNetworks`. Do not hand-edit `shared/openapi.json` or `src/shared/api/schema.d.ts`.

`server/data.ts` holds the sample roster. The API parses them with the Zod schemas before they leave the server. The UI never imports that file.

Stories live in `stories/` so they stay out of the architecture diagram. Tests live next to the code. Legacy research notes live in `docs/legacy/`.

## Scripts

```sh
bun run validate       # the agent finish line: static gate + api:check + build + coverage
bun run check:static   # typecheck, lint, fmt:check, fsd, dead-code, duplicates
bun run typecheck      # tsc --noEmit
bun run lint           # oxlint
bun run fmt            # oxfmt
bun run fsd            # steiger, strict recommended rules
bun run dead-code      # fallow: unused files, exports, dependencies
bun run duplicates     # fallow dupes, strict, fail on any clone
bun run api:generate   # openapi.json + schema.d.ts from Zod
bun run test:unit      # vitest
bun run test:coverage  # vitest with coverage floors
bun run coverage:ratchet # raise coverage floors to the measured values
bun run test:e2e       # playwright
bun run test:mutate    # stryker on model/lib
bun run storybook      # :6006
```

Coverage floors live in `config/coverage-floors.json` and only move up. Commits follow Conventional Commits (commitlint); pre-commit runs gitleaks plus `bun run validate`.
