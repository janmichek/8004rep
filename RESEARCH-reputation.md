# 8004-check — reputation research: beating 8004scan at explaining feedback

Date: 2026-10-18. Goal: help a user decide **"can I trust this agent's feedback?"**, spot bad players, and make every number re-derivable by hand.

## 1. What the standard gives us (ERC-8004 Reputation Registry)

- `giveFeedback(agentId, value int128, valueDecimals 0–18, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. Only `value` + `valueDecimals` are required.
- Stored on-chain: `value, valueDecimals, tag1, tag2, isRevoked, feedbackIndex`. **`endpoint`, `feedbackURI`, `feedbackHash` are only emitted in `NewFeedback`**, never stored → logs or an indexer are needed for them.
- Submitter **MUST NOT** be the owner or an approved operator — enforced against the owner only; nothing stops the owner's *other* wallets.
- `getSummary(agentId, clientAddresses, tag1, tag2)` — `clientAddresses` is mandatory. The spec says plainly: *"results without filtering by clientAddresses are subject to Sybil/spam attacks"* and *"more complex reputation aggregation will happen off-chain"*. The spec expects third parties to build **reviewer reputation**. That is the job of this 8004rep.
- Feedback file (`feedbackURI`): required `agentRegistry, agentId, clientAddress, createdAt, value, valueDecimals`. Optional `tag1, tag2, endpoint, mcp{tool,prompt,resource}, a2a{skills,contextId,taskId}, oasf{skills,domains}, proofOfPayment{fromAddress,toAddress,chainId,txHash}`.
- `revokeFeedback` (author only, flagged, not deleted). `appendResponse` (anyone can respond: an agent refunding, an aggregator flagging spam) → `ResponseAppended`.
- Value scales are **free-form**: `87/0` starred, `9977/2` uptime %, `-32/1` trading yield. One average across tags mixes units.
- Validation Registry: `validationRequest` (owner) → `validationResponse(0–100, tag)` by the named validator. On 8004scan `total_validations = 0` across all chains today.

## 2. 8004scan, decoded

The public API (`https://www.8004scan.io/api/v1/public`, **CORS `*`**, no key) returns the full score breakdown per agent: `GET /agents/{chainId}/{tokenId}` → `scores.breakdown`. Algorithm `v5_leaderboard_policy`, version 5.2.

| Dimension | Weight | Inputs (from `details`) |
|---|---|---|
| Engagement | 0.30 | `average_score` (plain mean of feedback values), `feedback_count`, `star_count`, `view_count`, chats; `feedback_weight` ramps with count (0.3 at 3 rows, 1.0 at 49) |
| Service | 0.25 | MCP/A2A present, tool/skill counts, health check |
| Publisher | 0.20 | wallet score, validation bonus, certification |
| Compliance | 0.15 | metadata parse, completeness, endpoint domain verified |
| Momentum | 0.10 | activity, freshness, days since creation |

Then a **leaderboard policy**: `merit = 0.7·proof + 0.3·support`, mapped into a **score band `floor 78 … ceiling 95`** by evidence tier.

Ecosystem numbers (`GET /stats`, 2026-10-18): 1.0M agents, 4.02M feedback rows, 30k feedback/day, **average feedback value 92.86**, 0 validations.

### What this means

1. **Feedback is taken at face value.** `average_score` is a raw mean. No reviewer dedupe, no self/sybil filtering, no revocation impact visible, no time decay. More rows → *more* weight (`feedback_weight`), so farming volume is rewarded.
2. **Ratings are saturated.** Network mean ≈ 93 → a "92" is below average, yet looks great. No percentile or baseline is shown.
3. **Band clamping hides differences.** The 78–95 band explains the public observation that 11 of the top 20 leaderboard agents share **92.8** ([Agent Claude, "Anyone Can Review Anyone"](https://agentclaude.substack.com/p/anyone-can-review-anyone)).
4. **Feedback is a minority of the score.** ≈30% engagement, and inside that it is mixed with stars and page views (off-chain, gameable, not verifiable).
5. **Data hygiene.** Live rows show `tag1 = 0xc5d2…a470` = `keccak256("")` (a client hashing an empty tag), `feedback_hash = 0x0…0`, empty `feedback_uri`. 8004scan shows these as-is.
6. **Unknown tags score as nothing.** In `/feedbacks`, rows tagged `starred` carry `score: 100`; rows with other tags carry `score: null`. Base Sepolia agent 6832 has 34 rows (values 60–100, tags `x402`/`stripe`) and 8004scan reports `average_score: 0`, total 12.05. Observed, not documented: 8004scan appears to score only tags it knows. A legit agent rated on a domain tag looks *worse* than a farmed `starred` one.
7. **Good parts worth matching:** cross-chain links, endpoint domain verification, MCP/A2A health checks, parse warnings per feedback.

## 3. Threat model: how feedback gets faked

| Attack | On-chain trace | Detectable here? |
|---|---|---|
| Owner self-review | `client == owner/agentWallet` | **Yes** (done) |
| Owner's side wallets | reviewer funded by owner; reviewer `tx.from` = owner | Partly: `tx.from` check done; funding needs address history |
| Sybil farm (N fresh wallets × 1 review) | fresh wallets (nonce < 5), same funder, same day, same value, no file | Nonce: yes. Funder: needs explorer API |
| One wallet spam | many rows, same value, bursts | **Yes** (burst/monotonous/hyperactive) |
| Bulk writer | many `NewFeedback` logs in one tx, via a batcher contract | **Yes** (tx checks) |
| Rubber-stamp reviewer | gives 100 to every agent it touches | Needs reviewer cross-agent history — feed by client exists |
| Collusion ring | agents A,B,C review each other; reviewer sets overlap | Needs network graph (subgraph) |
| Review bombing a competitor | burst of low values from fresh wallets | Burst + fresh + decline signal |
| Payment-proof replay | same `proofOfPayment.txHash` on several rows | **Yes** (done) |
| Lookalike agents | same owner/reviewer set/score across many agents | Network-level, needs indexer |

## 4. Metric catalogue

Grouped by question the user asks. ✅ = exists in code, 🆕 = proposed.

**"What is the real score?"**
- ✅ Weighted mean (authenticity weights), median, trimmed mean, Bayesian, time-decayed, LCB.
- 🆕 **Score waterfall**: raw → minus revoked → minus self → minus duplicates → after burst/repeat discounts = trusted. Each step names the rule and how many rows it touched. *The* explainability primitive.
- 🆕 **Network baseline**: show percentile vs the network mean (≈93), not just the number.
- 🆕 Per-tag scales: never average `starred` with `uptime`; show per-tag only when units differ.

**"How much evidence is there?"**
- ✅ Effective count, distinct reviewers, clients-eff (entropy), coverage (dated/tx/file/endpoint).
- 🆕 **Evidence strength** tier (none / thin / moderate / strong) from effective reviewers, concentration, and proof coverage — shown next to the score so a "100 from 2 wallets" reads as *thin*.
- 🆕 **Evidence ladder**: bare value → names endpoint/tag → feedback file → payment proof → validated.

**"Who is behind it?"**
- ✅ Reviewer table: share, weight share, leave-one-out shift, flags.
- ✅ Tx: sender, direct call, bulk tx, fee; reviewer nonce/kind.
- 🆕 Reviewer profile page: across agents — count, mean given, % of 100s, fresh-wallet, first seen. Label: *rubber stamp*, *critic*, *spread*, *new*.
- 🆕 Funding cluster (Blockscout `/api/v2/addresses/{a}/transactions`, CORS-open on most chains): first funder of each reviewer; many reviewers sharing a funder = cluster.

**"Is anything off?"**
- ✅ Risk signals: self, concentration, fragile, discounted, surge, revocations, decline, off-scale, outliers, unlisted endpoint, undated.
- 🆕 Responses (`appendResponse`): show agent replies and aggregator spam flags next to the row.
- 🆕 Hash-as-tag / zero hash hygiene notes.

**"How does this compare to 8004scan?"**
- 🆕 **Side-by-side**: fetch 8004scan's breakdown live, show its dimension weights and the feedback inputs it used (`average_score`, `feedback_count`), and explain the gap to our trusted score in one sentence.

## 5. Explainable UX principles

1. **Answer first, evidence second.** One headline sentence ("Trusted 71 · raw 93 · thin evidence, 1 reviewer wrote 80%") before tables.
2. **Every number is clickable down to rows.** Score → waterfall step → the rows it touched → tx detail.
3. **Show uncertainty, not false precision.** Evidence tier + n beside every score; "not enough evidence" beats a confident 100.
4. **Name the rule, not the model.** Each flag/step carries its rule text (`FLAG_INFO`) — no black-box ML.
5. **Say what we could not check.** "Unknown" ≠ "pass"; coverage and scan window are always visible.
6. **Neutral language.** Signals describe facts ("80% of rows from one address"), never accuse.
7. **Compare against a baseline.** Network average and 8004scan's number, so users calibrate.

## 6. Roadmap

| Phase | Scope | Data |
|---|---|---|
| **1 (this change)** | Trust summary: headline, evidence strength, score waterfall, 8004scan comparison | existing feedback + 8004scan API |
| 2 | Reviewer profile route `/reviewers/:slug/:address` with cross-agent stats & labels | `listFeedback({client})` |
| 3 | Responses + validations on agent page | subgraph `responses`, validation registry reads |
| 4 | Funding clusters via Blockscout; cluster chip on reviewers | Blockscout API |
| 5 | Network health page: rating distribution, top suspicious reviewers, lookalike agents | subgraph network feed |

## Sources

- ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
- 8004scan API: https://www.8004scan.io/api/v1/public (`/agents/{chainId}/{tokenId}`, `/feedbacks`, `/stats`), docs via https://skills.lc/yejiming/web3-awesome-skills/yejiming-web3-awesome-skills-skills-community-identity-8004scan-skill-md
- Critique: https://agentclaude.substack.com/p/anyone-can-review-anyone
- 8004scan feature summary: https://x.com/alt_layer/status/2013546554552983806
