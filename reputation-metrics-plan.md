# Reputation Metrics — Audit & Implementation Plan

*24 Oct 2026 · companion to `erc8004-reputation-metrics.md` (the "spec") · Phase 0 and the classic-design slice of Phase 1 are implemented (see status notes below); Phase 2/3 are not started*

Contents

1. Verdict in one page
2. Audit of the metrics the app ships today
3. Validation of the research spec
4. Gap matrix: spec vs. app
5. The plan — fix / implement / update / remove, by phase
6. Target formulas (v1, as adjusted here)
7. Open decisions
8. Test & acceptance strategy

---

## 1. Verdict in one page

**Project intent** (README + spec): show how much an ERC-8004 agent's reputation is actually worth, i.e. what is behind the number, with every value re-derivable by the reader.

**Current app — strong on transparency, weak on the core score.**

- The *explanation machinery* is excellent and ahead of every competitor the spec surveys: the score waterfall, per-row flags with printed rules, leave-one-out "without it", the per-row Tx detail (sender, file integrity hash, restated fields, payment existence / parties / order / reuse), coverage meters, the 8004scan comparison. Keep all of it.
- The *score it explains* has three defects that make it misleading on real data:
  1. **The duplicate rule penalises agreement between independent reviewers.** `dupKey` (`src/data/scores.ts:90`) omits the client, so the second reviewer to give the same `(value, tag1, tag2, endpoint)` gets weight 0. Reproduced: 50 different wallets give `100/starred`, one gives `20/starred` → **trusted score 60, 2 effective votes, "2 independent voices"** (raw mean 98.4). A well-liked agent is scored as badly as a polarised one. This is the most urgent fix.
  2. **Every tag is averaged as if it were a 0–100 rating.** Latency in ms, uptime %, revenue in USD, `-100` disputes, 0/1 pass flags and 5-star ratings all enter the same mean. Reproduced: `responseTime=53`, `uptime=100`, `starred=90` → trusted 81. The spec calls this "semantic collapse"; the app has it in the trusted score, the raw tile, the network average, the owner average and the histogram.
  3. **No per-reviewer cap.** Discounts are per row (`× 0.7` hyperactive, `× exp(−(N−2))` burst), so a wallet that spaces 1,000 varied ratings out over time keeps ~700 votes. On subgraph networks this is compounded by the **100-row cap** (`FEEDBACK_LIMIT`, `src/data/subgraph.ts:16`): every metric for a busy agent is computed on its latest 100 rows. The Celo #9308 case has 3,455 rows on-chain.
- Several shipped numbers carry no decision value (Positive rate, Bayesian-with-prior-0, Ecosystem average, network "Average value") or repeat each other (HHI, inverse HHI, Gini, evenness, entropy-voices, top-share — six concentration measures across the classic view and the variants).

**Research spec — direction right, sources mostly accurate, a few corrections, two design flaws.**

- Its central idea is right, and it is the product thesis: move the unit of counting from *feedback* → *wallet* → *independent entity*, cap each entity's influence, weight by evidence, show the evidence chain behind each flag.
- Checked against primary sources: ERC-8004 spec facts are correct; the paper exists and 11 of 13 cited figures match it (two are minor misattributions); the QuickNode formula is quoted correctly; the 8004scan single-wallet case holds on-chain (3 clients, one with 3,453 records).
- **Correction:** the 8004scan "score transparency gap" is reconstructable, not undocumented: `total = floor + (ceiling − floor)·merit/100`, with `merit = 0.7·proof + 0.3·support`. 43.1 is a legacy dimension sum that no longer feeds the headline. The app's own Compare tab explains 8004scan with that outdated model, so it is wrong too.
- **Design flaw 1:** in the robust score the evidence and credibility multipliers (0.15 × 0.2 = 0.03 per unverified entity) are on a different scale from the prior α0 = 3. With ~99% of feedback at L0, a prior of 3 equals ~100 real reviewers, so almost every agent comes out at ≈ 50 with a wide interval. That is honest, but nobody can rank on it. Fix in §6.
- **Design flaw 2:** Layer 0 (entity resolution with traces, INFRA labels, CEX deposit reuse, Louvain, cross-chain union) needs an indexer and a backend. The app is a static SPA. The spec never splits "computable per agent in the browser" from "needs a pipeline", and the plan has to.

**Plan shape:** Phase 0 fixes correctness (days). Phase 1 rebuilds the score core client-side: kinds, rating units, wallet caps, interval, unrated state, funnel, cost to fake (1–2 weeks). Phase 2 adds bounded on-chain enrichment in the browser through the existing relay: funding depth, owner-linked, burner, evidence aggregate. Phase 3 is an indexer for network-wide entities, farms and leaderboards, and is a go / no-go decision for you.

---

## 2. Audit of the metrics the app ships today

Legend: **Keep** · **Fix** (right idea, wrong computation) · **Replace** (superseded by a Phase 1 metric) · **Demote** (move to Methods / advanced) · **Remove**.

### 2.1 Agent page — header tiles (`ReputationPanel.vue`)

| Tile | Computation | Verdict | Why |
|---|---|---|---|
| Trusted score | `computeScores().weighted` — Σw·x/Σw over all tags | **Fix → Replace** | Wrong on real data because of dup bug, mixed kinds, uncapped wallets (§1). Replaced by Robust score ± interval (§6.3). |
| 95% bound (hint) | `weighted − 1.96·sd/√W`, floored at min | **Replace** | Normal approximation on bounded, heavily skewed data; W is fractional and inflated by the bugs. Use the Beta interval (§6.3). |
| Evidence tier | `clientsEff` + `effectiveCount` + top share | **Replace** | Right idea (spec's confidence). Re-base on wallets/entities after caps; rename to *Confidence*. |
| Risk level | worst signal level | **Keep, later Replace** | Becomes the Integrity grade (spec §4) once Phase 2 signals exist. |
| Raw on-chain | `getSummary` (RPC, ≤200 clients) or mean of latest 100 rows (subgraph) | **Fix** | Label says "on-chain" but on subgraph networks it is a 100-row sample. Also mixes kinds — that is fine for a *raw baseline*, but say so. Pair with Inflation Gap. |
| 8004scan | `total_score` | **Keep** | Useful contrast. |
| Ecosystem avg | 8004scan mean of every feedback value | **Remove** | Mean across revenue in USD, −100 disputes, 5-star and ms. Meaningless; also drawn as a marker on the histogram. |

### 2.2 Agent page — Overview tab

| Element | Verdict | Why |
|---|---|---|
| Signals list ("What stands out") | **Keep / Fix** | Good shape (level · code · plain text). Individual signals below. |
| ↳ `self` | **Fix** | The contract already forbids owner/operator submits, so this fires essentially only on the agentWallet, or on a *current* owner who rated before buying (which is the opposite risk, carryover). Compare owner **at the feedback block**; add operators. |
| ↳ `concentration` (top share ≥ 0.5 / 0.8) | **Keep** | = spec #2 Top1. Move from rows to rating weight after caps; keep the row-based figure as a second number. |
| ↳ `fragile` (leave-one-out) | **Keep** | Not in the spec; very legible. Recompute on the robust score. |
| ↳ `discounted` (W/n < 0.5) | **Replace** | Becomes the funnel / Inflation Gap. |
| ↳ `surge` (last 7 d > 3× prior weekly) | **Keep** | Lightweight spec #10. |
| ↳ `revocations` | **Keep** | Spec #16 (RevRate). |
| ↳ `decline` | **Keep** | Useful; compute on ratings only. |
| ↳ `off-scale` (outside 0–100) | **Replace** | Becomes Semantic Validity (`OOR` against the *inferred* scale). |
| ↳ `outliers` (robust z > 3.5) | **Fix** | Only meaningful within one kind and scale; today 53 ms latency is an "outlier" next to 100-star ratings. |
| ↳ `unlisted-endpoint` | **Keep** | Not in the spec; a good cheap signal. |
| ↳ `undated` | **Keep** | Honest coverage note. |
| Strength reasons | **Replace** | Re-word around the funnel. |
| Feedback over time, by weight | **Keep** | Add burst highlighting (spec UI §6.6). |
| Values histogram | **Fix** | Per kind (ratings only, normalised 0–1), drop the ecosystem marker. |
| Score waterfall | **Keep, re-base** | Best transparency element in the app. Steps become: all rows → drop revoked → drop non-rating kinds → drop self/owner-linked → collapse to rating units → cap per wallet → prior → robust score. |
| Evidence ladder (bare / context / file) | **Fix** | It is the spec's L0/L1 split. Extend to L1 *declared* (file has proofOfPayment / taskId) vs L3 *verified* (Phase 2), counted per rating unit, not per row. |
| Coverage meters | **Keep** | Add "rows read of total" (subgraph cap). |

### 2.3 Methods tab (`MethodsTab.vue`)

| Metric | Verdict | Why |
|---|---|---|
| Weighted | **Replace** | See Trusted score. |
| Median / trimmed mean | **Demote** | Robust alternatives, but per-row (one wallet's 3,000 rows still decide them). Keep as per-wallet-median alternatives in Methods. |
| Bayesian (prior 0, weight 5) | **Replace** | A prior of 0 drags every small agent to "bad"; the robust score uses a neutral prior. |
| Time-decayed | **Demote** | Folds into rating-unit weights (w_time). |
| 95% bound | **Replace** | Beta interval. |
| Gap raw − trusted | **Keep → rename** | = Inflation Gap. Promote to the header. |
| Trust mass W/n | **Replace** | Funnel ratio N_fb / N_wallets / N_ent says the same thing in counts. |
| Independent voices exp(H) | **Replace** | Use N_eff = 1/HHI over capped wallet weights (one concentration index, not three). |
| Consensus | **Demote** | Low decision value. |
| Polarization | **Demote** | Useful only next to review-bombing; keep in Methods. |
| Positive (x > 0) | **Remove** | On a 0–100 scale only a literal 0 is "not positive". No information. |
| Momentum | **Demote** | Fine, minor. |
| By-tag table | **Fix → Replace** | Becomes the Ratings / Telemetry / Unknown tabs (spec #12). |
| Rule lists | **Keep** | Update to the new rule set + `formula_version`. |

### 2.4 Weight rules (`computeWeights`, `scores.ts:103`)

| Rule | Verdict | Replacement |
|---|---|---|
| `revoked` → 0 | **Keep** | — |
| `self` → 0 | **Fix** | owner-at-block, operators, agentWallet-at-block; later owner-linked (Phase 2). |
| `duplicate` → 0 (cross-client) | **Remove (bug)** | Rating units dedupe *within* a wallet; cross-wallet identity of values is agreement, not duplication. Keep a cross-wallet *template* signal (spec #11) as a flag, never a weight. |
| `burst` × exp(−(N−2)) | **Replace** | A 30-day rating unit takes the median of a burst, and the wallet cap bounds it. Keep "burst" as a flag. |
| `monotonous` × 0.4 | **Replace** | A unit median collapses it already; keep as a flag (rubber-stamp). |
| `hyperactive` × 0.7 | **Replace** | The wallet cap (min(1, Σ w_time)) does this properly. |

### 2.5 Tx detail (`txChecks.ts`) — the strongest part of the app

Keep all groups. Specific fixes:

- `pay-parties`: the payee should be **agentWallet at the payment block** (spec's attribution rule). Owner as payee should *warn*, because an owner wallet often pays for gas and cannot prove a client relationship. Add: payer ∉ {owner, agentWallet} (otherwise it is a self-payment and fails).
- `rev-independent`: once Phase 2 lands, use the funding-path check instead of address equality, and update the rule text.
- `agent-validation`: the text "No ERC-8004 validation registry is deployed yet" is probably stale (QuickNode and 8004scan both report validations on some networks). Verify per chain; fold into spec #23.
- `agent-weight`, `agent-voice`, `agent-concentration`, `agent-influence`: re-base on the new weights.
- New aggregate: run the file + payment checks over **all** rows with a `feedbackURI` (bounded, cached) to produce the agent-level Evidence-Backed Share (Phase 2).

### 2.6 Reviewers tab, reviewer profile, network, owner

| Element | Verdict | Why |
|---|---|---|
| Shared funders (first funder, top 12 reviewers) | **Keep → extend** | The seed of spec #3/#4. Limits: depth 1, first 25 txs only, top 12 only, no INFRA filter (only a testnet-faucet caveat). |
| Weight share / Without it | **Keep** | Re-base. |
| Nonce < 5 "fresh wallet" | **Keep → extend** | Becomes one input to the burner score (#9). |
| Labels rubber-stamp / single-agent / bulk / mass / harsh | **Keep** | ≈ spec #11 / #14 / #10 / #14 / #17. Compute on ratings only; add Fanout = agents/rows. |
| Network: reviews, agents, reviewers | **Keep** | Add the funnel at network scale. |
| Network: Average value | **Fix** | Ratings-only normalised mean, plus kind mix. |
| Network: Perfect 100s | **Keep** | Extend to ExtremeShare (≥ 0.99 normalised). |
| Network: suspects, lookalike agents (Jaccard of reviewer sets) | **Keep** | A good proxy for spec #20 sibling overlap and the spec #15 dense block; window-bounded. |
| Owner: Average rating (mean of agents' raw means) | **Fix** | Use robust scores; show the portfolio count and batch-mint signals (#20). |

### 2.7 Variants (`src/variants/shared/metrics.ts` + 21 designs)

- `rankScore` shrinks the **raw on-chain average**, so every leaderboard-style variant (League, Ticker…) ranks agents on the number the project exists to distrust. **Replace** it with the robust score.
- `letterGrade` bands the buggy trusted score. **Replace** it with the spec's Integrity grade, which is separate from the score.
- `gini`, `evenness`, `effectiveCount`, `topShare` and `clientsEff` all measure concentration. **Consolidate** to Top1, Top3 and N_eff (HHI-based) on capped weights; keep Gini only where a design needs it, computed the same way.
- `velocity`, `activeDays`, `weekHourGrid`, `candles`, `runningAverage` are presentation series. Keep them, and run them on ratings only.
- Structural point: 21 designs multiply the cost of every metric change. All variants should read one `ReputationReport` object and compute nothing themselves (§5, task 1.10).

---

## 3. Validation of the research spec

### 3.1 Fact check against primary sources

| Claim | Source | Status |
|---|---|---|
| Only owner / approved operator blocked from `giveFeedback` | EIP-8004 | ✅ ("MUST NOT be the agent owner or an approved operator"). Note: agentWallet is *not* blocked. |
| `value` int128 + `valueDecimals` | EIP-8004 | ✅ decimals 0–18. |
| `getSummary` = mean; Sybil-prone without client filter | EIP-8004 | ✅ and the spec requires `clientAddresses` non-empty. The app passes all clients (≤ 200), which reproduces the naive mean. |
| agentWallet cleared on transfer | EIP-8004 | ✅ |
| Validation requested by owner/operator, response 0–100 | EIP-8004 | ✅ ("self-selected validators" holds). |
| `.well-known/agent-registration.json` domain check | EIP-8004 | ✅ optional. |
| `appendResponse` callable by anyone | EIP-8004 | ✅ |
| Paper exists, ETH/BSC/Base, data to 13 May 2026 | arXiv 2606.26028 (v3, 18 Oct 2026) | ✅ |
| Sybil reviewers 73.5 / 59.2 / 90.6% | paper abstract | ✅ |
| No valid feedback left 15.8 / 77.9 / 86.8% | Table 7 | ✅ |
| No payment / task link 98.7 / 100 / 99.3% | §7.4 | ✅ |
| 6.2% of Base reviewers with x402 history | §7.4 | ✅ (they account for 5.1% of feedback). |
| Median k = 1; $0.055 / $0.0042 / $0.0027; 259× | Table 6, §7.5 | ✅ (259× = $0.7 median attributed payment / $0.0027). |
| 1,181 records from one reviewer→agent pair | R3 | ✅ |
| 80 wallets × 10 score-100 to 10 agents, 79 inactive after | App. G.3 | ✅ (paper says "short-lived", not "burner"). |
| Spearman ρ ≈ 0.05 BSC–Base | App. E | ✅ (ETH–Base 0.14). |
| "One tag alone produced 730 records ~100–5,000" | §7.2 | ⚠️ Reword: of 764 Base records above 100, 730 (95.5%) are tagged `revenues`. |
| BSC group: score 70 = 73% of 21,863 records | App. G.3 | ✅ (73.2%). |
| 56 wallets, 8 pre-txs → 10 contiguous nonces | App. G.3 | ✅ |
| "Paper Eq. 20" for Fanout and RS | paper | ⚠️ Fanout is Eq. 20, RS is Eq. 22. |
| "Paper Eq. 3–4" manipulation cost | paper | ❓ not confirmed; Appendix F has the crafted-value form as Eq. 14–15. Re-check before citing. |
| Only 3 / 4 / 15% valid file with a service | §5.4 | ✅ the body says *declared* service (the abstract says "live"). |
| Paper's Sybil method: first-funder trees, contracts as infra, resolve to EOA "whenever possible" | §7.6 | ✅ (no fixed depth stated; the spec's D = 3 is its own choice). |
| QuickNode v1.4 formula, weights, filters, tiers | QuickNode page | ✅ Add: its tag whitelist includes `responseTime`, `uptime`, `successRate`, so 53 ms passes its [0,100] filter and is averaged as a rating. More evidence for spec #12. |
| 8004scan Celo #9308: "3,428 feedback = 1 wallet" | on-chain `getClients` / `getLastIndex` | ✅ in substance: 3 clients; `0x7111…2954` holds 3,453 records, the other two 1 each. Use "≈ 1 wallet (99.9%)". |
| 8004scan "weighted contributions sum to 43.1, headline 92.7, mapping undocumented" | 8004scan API | ❌ **Correct this.** The API exposes `leaderboard_policy`: `merit = 0.7·proof_score + 0.3·support_score = 0.7·100 + 0.3·54.22 = 86.27`, then `total = floor + (ceiling − floor)·merit/100 = 78 + 17·0.8627 = 92.67` (band 78–95). The 43.1 is the legacy dimension sum (Engagement 30 / Service 25 / Publisher 20 / Compliance 15 / Momentum 10), which no longer drives the headline. The real criticism stands, just more precisely: `proof_score = 100` and `feedback_signal_score = 100` come from one wallet's telemetry, and the 70% proof weight lets that dominate. |
| 8004agents.ai #52158, TrustLayer details | — | ❓ not re-checked. |

### 3.2 Methodology review

Sound and worth building as written:

- Counting unit funnel (#1), concentration on entity weight (#2), owner-linked via funding (#3), funding-root share (#4), evidence levels with a wash-payment check (#5), manipulation cost (#7: the algebra checks out, `X = W′(τ − S)/(1 − τ)`; 24 → 800 / 120 reproduces), repeat intensity (#8), semantic kinds (#12), unrated state, formula_version + inputs download.
- Wording rule ("pattern consistent with…", always show evidence). Essential, given the paper's high base rates.

Needs changing:

1. **Weight scale vs prior (robust score #6).** `W_e = … · w_ev · w_cred` puts an unverified entity at 0.03 while α0 = 3, so the prior equals ~100 unverified entities. With 99% L0 feedback nearly every agent reads ≈ 50 ± 30, "low confidence", and ranking is impossible. Fix: express weights **relative to one independent unverified wallet = 1**, let evidence *boost* (L3 up to ×3) rather than unverified *shrink*, and keep α0 = 3 in the same unit. Bounded influence still holds, because each entity is capped at its multiplier and owner-linked weight stays 0. §6.3 has the formula; §7 lists it as a decision.
2. **Per-client scale inference is fragile with few values.** A 0–100 rater who always gives 4 is classed 5-point; one who gives only 1s is classed binary. Infer per **(tag1)** across all clients of the chain (or agent, client-side), and let a client override only with ≥ 5 values that contradict the tag-level scale. Real data also has **signed** ratings (`dispute = −100`, seen in 8004scan's feed): add `SIGNED_RATING` (−S..S → r = (v + S)/2S), not just `SIGNED_PCT`.
3. **Entity edges L6/L7 (lifecycle, template) at 0.5/0.4 can sum past θ = 0.8.** Two unrelated users of the same SDK (identical JSON skeleton) in the same hour would merge. Use L6/L7 as corroboration for an existing L1–L5 edge only, never as a standalone edge.
4. **H(c) is not a necessary condition.** Payer and reviewer can be different addresses: a smart account pays and an EOA rates, or an agent pays from its agentWallet and rates from its operator. x402 also has non-EIP-3009 schemes. Present it as "reviewer has payment history", never "could not have paid".
5. **INFRA threshold of 5,000 funded wallets is too high** for bridge solvers and fillers (Relay, Across) and small CEXs, which are the first funders of many unrelated fresh wallets. Use label lists first, then a relative heuristic: a funder whose children span many unrelated agents *and* receive diverse later activity.
6. **REV2 credibility (#13)** needs a dense reviewer×agent graph; ERC-8004 is sparse (most reviewers rate 1–3 agents). Low return for effort L. Defer until the entity graph exists, then try EigenTrust with pre-trust on verified payers instead.
7. **Integrity grade A needs EBS ≥ 0.30.** At today's base rates, roughly no agent qualifies. That is acceptable as long as B is reachable without evidence, and it is, as written. Keep, and publish the grade distribution so users see that A is rare by design.
8. **Feasibility split is missing.** Each metric needs a "where it runs" tag: *browser* (per agent, bounded calls), *browser + explorer API* (per reviewer, rate-limited), *indexer* (network-wide graphs). §4 adds the column.

---

## 4. Gap matrix: spec vs. app

Status: ✅ have · 🟡 partial · ❌ missing. Runs: **B** browser from rows · **E** browser + explorer/relay calls · **I** needs an indexer.

| # | Spec metric | Status | What exists | Runs | Phase |
|---|---|---|---|---|---|
| — | Tag kinds + scale inference (§2.2) | ❌ | `off-scale` 0–100 flag, by-tag table | B | 0–1 |
| — | Rating units (§2.3) | ❌ | per-row burst/monotonous discounts | B | 1 |
| — | Entity resolution (§2.4) | 🟡 | first funder, depth 1, top-12 reviewers | E (bounded) / I (full) | 2 / 3 |
| 1 | Independent Reviewers funnel | 🟡 | rows, distinct clients, exp(H) voices | B (wallets) · E (entities) | 1 / 2 |
| 2 | Concentration Top1/Top3/HHI/N_eff | 🟡 | top share signal, HHI in Tx detail, 4 more in variants | B | 1 |
| 3 | Owner-Linked Share | 🟡 | address equality; funder == owner/wallet | E | 2 |
| 4 | Coordinated-Cluster / RootShare | 🟡 | shared first funder among 12 | E / I | 2 / 3 |
| 5 | Evidence-Backed Share | 🟡 | ladder bare/context/file; per-row payment checks on demand | E | 2 |
| 6 | Robust score ± CI + Inflation Gap | 🟡 | weighted mean, LCB, gap | B | 1 |
| 7 | Manipulation cost | 🟡 | per-row fee only | B (+ gas price) | 1 |
| 8 | Repeat-Rating Intensity | 🟡 | hyperactive, clientRows | B | 1 |
| 9 | Burner-Wallet score | 🟡 | nonce < 5, single-agent label | E | 2 |
| 10 | Burst & Lockstep | 🟡 | burst rule, surge, bulk, tx-single, heatmap | B (burst, same-block) · I (lockstep) | 1 / 3 |
| 11 | Template Uniformity | 🟡 | monotonous, rubber-stamp, entropy, perfect 100s | B | 1 |
| 12 | Semantic Validity | ❌ | off-scale flag | B | 0–1 |
| 13 | Reviewer Credibility | ❌ | — | I | defer |
| 14 | Queue-Sweep / Fan-out | 🟡 | mass / single-agent labels | B (window) · I | 1 / 3 |
| 15 | Collusion & Reciprocity | 🟡 | lookalike agents (Jaccard) | I | 3 |
| 16 | Revocation patterns | 🟡 | revocation signal, rev-stands | B | 1 |
| 17 | Review-bombing | 🟡 | harsh label, decline signal | B | 1 |
| 18 | Cross-chain divergence | ❌ | (8004scan exposes `cross_chain_links`) | E | 2 |
| 19 | Liveness & registration validity | 🟡 | file parse, unlisted endpoint | E (relay probes) | 2 |
| 20 | Owner portfolio & sibling overlap | 🟡 | owner page, lookalikes | B / E | 2 |
| 21 | Ownership-change carryover | ❌ | — | E (Transfer logs) | 2 |
| 22 | Economic activity | ❌ | — | E (wallet tokentx) / I | 3 |
| 23 | Validation metrics | ❌ | stale "not deployed" text | B (RPC) | 2 |
| 24 | Telemetry panel | ❌ | telemetry is averaged into the score | B | 1 |
| 25 | Responsiveness | 🟡 | responses attached, "With replies" filter | B | 1 |
| §4 | Integrity grade + flag catalogue | 🟡 | risk level, letter grade (variants) | B / E | 1 / 2 |
| §6.9 | formula_version + inputs JSON | ❌ | — | B | 1 |

The app has these and the spec does not; keep them and add them to the spec: score waterfall, leave-one-out, `unlisted-endpoint`, instant review after registration, feedback-file integrity (hash / canonical JSON), file restates the on-chain row, payment reuse across reviewers, sender ≠ reviewer (relayed / sponsored), multiple `NewFeedback` per tx, coverage meters, 8004scan comparison.

---

## 5. The plan

Effort: S ≤ 1 day · M 2–4 days · L 1–2 weeks. Each task lists its files and acceptance criteria.

### Phase 0 — Correctness fixes (ship first, ~3–4 days) — **done**

All six items shipped. 0.1 dedupes within a client (regression test added), 0.2 lives in `src/data/reputation/kinds.ts`, 0.3 paginates to a 5,000 ceiling and surfaces "computed on N of M reviews", 0.4 parses `leaderboard_policy`, 0.5 removes the no-value tiles, 0.6 updates the validation text. Tests: 215 → 242.

**0.1 Remove the cross-client duplicate rule** · S
- `src/data/scores.ts` (`dupKey`, `computeWeights`), `trustReport.ts` (waterfall step `duplicate`), `feedbackStats.ts` (`FLAG_INFO.duplicate`), `txChecks.ts` (`WEIGHT_RULES`).
- Interim (before Phase 1): dedupe only **within a client**, keyed on (client, value, tag1, tag2, endpoint).
- Accept: 50 wallets × 100 + one 20 → trusted ≈ 98.4, voices ≈ 51. Add this case as a regression test in `scores.test.ts`.

**0.2 Tag-kind registry + ratings-only scoring** · M
- New `src/data/tagKinds.ts`: curated map (spec §2.2, plus `SIGNED_RATING`, plus the tags seen live: `settled`, `paid`, `dispute`, `certificate_issued`, `personality`, `review:submission`, `acceptance-v2`); normalisation of tag spelling (case, trim, camel/snake).
- Scale inference per tag across the agent's rows (§3.2 point 2); `normalise(f) → r ∈ [0,1] | excluded`.
- The trusted score, outliers, histogram, decline and network average use RATING rows only; the others are listed separately.
- Accept: `responseTime=53, uptime=100, starred=90` → score from `starred` only; an agent with only telemetry renders **"Unrated — telemetry only"**.

**0.3 Subgraph row cap made visible, then lifted** · S–M
- `src/data/subgraph.ts`: paginate feedback (`skip`/`first`, or `createdAt_lt` cursor) up to a ceiling (e.g. 5,000), compare with `agent.totalFeedback`.
- Coverage banner: "computed on N of M reviews". Raw tile: say "mean of N rows" when it is not `getSummary`.
- Verify whether the subgraph `value` is already scaled by `valueDecimals` (`mapFeedback` uses `Number(row.value)`, while RPC and logs divide by 10^decimals). Add a test either way.

**0.4 Fix the 8004scan Compare tab** · S
- `src/data/scan.ts`: parse `leaderboard_policy` (`weights.proof/support`, `proof_score`, `support_score`, `support_details`, `merit_score`, `score_band`, `evidence_tier`, `integrity_tier`, `feedback_signal_score`).
- `CompareTab.vue`: explain `total = floor + (ceiling − floor)·merit/100` with the live numbers; show the legacy dimensions as "legacy breakdown"; remove the claim that feedback reaches the score only through Engagement, and the "starred" guess.
- Accept: Celo #9308 shows 0.7·100 + 0.3·54.2 = 86.3 → 92.67.

**0.5 Remove no-value numbers** · S
- Remove: Ecosystem avg tile + histogram marker (`ReputationPanel.vue`, `OverviewTab.vue`), Positive rate and Bayesian-prior-0 (`MethodsTab.vue`, `ScoreSet.posRate`, `bayes`).
- Network "Average value" → ratings-only mean (after 0.2).

**0.6 Stale text** · S
- `txChecks.ts` `agent-validation`: check ValidationRegistry addresses per chain in `chains.ts`; say "not deployed on <chain>" or count validations.
- `self`: compare against owner **at block** when the block is known; otherwise label it "current owner".

### Phase 1 — Score core v1, browser-only (~1.5–2 weeks) — **classic design done; variants pending**

Shipped: 1.1 (`kinds/units/score/report`), 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 (findings), 1.8, 1.9, 1.11, 1.12. 1.13 is partly done (network average is ratings-only, Owner page relabelled). 1.10 (one report for every design) is deliberately deferred: the 21 variants still use the legacy `scores.ts` API, which is kept compatible.

**1.1 New module `src/data/reputation/`** · M — shipped `kinds.ts`, `units.ts`, `score.ts`, `report.ts`; `concentration` and `signals` live inside `units.ts` / `feedbackStats.ts` rather than as separate files.
- `kinds.ts` (from 0.2), `units.ts` (rating units), `score.ts` (robust score, interval, cost), `concentration.ts`, `signals.ts`, `report.ts` → one `ReputationReport` object with `formulaVersion: 'rep-1.0'` and `params`.
- `scores.ts`, `trustReport.ts` and the score parts of `feedbackStats.ts` become thin adapters, then are deleted once the UI moves over. Keep the row-flag and reviewer-table parts of `feedbackStats.ts`.

**1.2 Rating units** · S — spec §2.3: unit = (client, tagGroup, 30-day window), r_u = median. Per-row `burst` / `monotonous` / `hyperactive` become **flags only**.

**1.3 Robust score ± interval + confidence + Unrated state** · M — formula in §6.3. Header shows `Robust 74 ± 9 · medium confidence`, muted `raw 98 (+24 inflation)`.

**1.4 Inflation Gap** · S — `raw_0–100 − robust` and `raw_all − robust`; replaces "Gap raw − trusted".

**1.5 Independent Reviewers funnel** · S — `N_fb → N_wallets → N_units → N_wallets_after_cap` now; the entity and evidence steps appear when Phase 2 fills them (render "not traced" rather than hiding them). Flag `N_fb / N_wallets ≥ 20` → "feedback volume is not reviewer volume".

**1.6 Concentration consolidated** · S — Top1, Top3, N_eff on capped weights *and* on raw rows; stacked bar of top wallets + others. Delete HHI / evenness / Gini duplicates in `txChecks.ts` and `variants/shared/metrics.ts` (re-export from one place).

**1.7 Repeat intensity, template uniformity, revocation, review-bomb, burst** · M
- #8 MaxPair, RepeatShare, records-per-reviewer histogram.
- #11 σ_r, D_score, ExtremeShare (ratings, normalised); keep rubber-stamp.
- #16 RevokeReplace (revoke r ≤ 0.4, then r ≥ 0.8 within 7 d).
- #17 NegBurst on ratings.
- #10 burst ratio on daily counts; **same-block / same-tx share** when tx hashes are known (RPC log scan has them; check whether the subgraph exposes `txHash`/`blockNumber` — add the fields to `FEEDBACK_FIELDS` if so).

**1.8 Ratings / Telemetry / Unknown tabs** · M — replace the by-tag table. Telemetry panel (#24): per monitor wallet, latest value, p50/p95, monitor count. Never averaged into the score.

**1.9 Manipulation cost card** · S — raw explorer: `k_raw` and `v*` (1 tx), cost = k · median fee (use the fees already read in Tx detail, or `eth_gasPrice` × the measured gas of `giveFeedback`). Here: `k = ceil(X)` fresh unlinked wallets (§6.4) × (fee + funding cost). Show both side by side.

**1.10 One report for every design** · M
- `variants/shared/use.ts` exposes `ReputationReport`; variants stop computing scores.
- `rankScore` → robust score; `letterGrade` → Integrity grade (interim: confidence + signals only; full grade after Phase 2).
- Touches ~33 variant files, mostly mechanical. See decision D4 on pruning variants.

**1.11 Responsiveness (#25)** · S — share of negative ratings with an owner/agentWallet response, median lag; responses by third parties listed separately.

**1.12 Formula version + inputs download** · S — footer: `rep-1.0`, parameter table, "Download inputs (JSON)" (rows, kinds, units, weights) so anyone can recompute.

**1.13 Re-base the waterfall, Tx detail checks, reviewer table, network and owner pages** · M — new steps (§2.2), new weights, Owner page on robust scores.

### Phase 2 — Bounded enrichment in the browser (~2–3 weeks)

All calls go through the existing relay (`api/fetch-json.ts`) where CORS requires it, cached per `(chainId, address)` in memory + `localStorage`, with concurrency limits and a visible "traced N of M" progress, like the current top-12 lookup.

**2.1 Funding graph v2** · M — `src/data/funding.ts`: depth up to 3, contract funders resolved to the triggering EOA, all reviewers up to a cap (e.g. 100, by weight), INFRA = a bundled label list (`src/data/infraLabels.json`: CEX hot wallets, bridges, solvers, faucets, paymasters/bundlers per chain) + a fan-out heuristic. Output: `root(x)`, RootShare (#4), funding tree view.

**2.2 Owner-linked share (#3)** · M — OwnerSet = owner + agentWallet + operators (+ other agents of the owner from the Owner page source); ownerLinked if same root, funding distance ≤ 2 in either direction, or value received from OwnerSet ≤ 30 d before the feedback. Weight → 0; flag with the path drawn `owner → 0xab… → reviewer`.

**2.3 Wallet-level entity merge (light §2.4)** · M — union-find over L1 (same non-INFRA root), L2 (same non-INFRA gas sponsor, from tx.from ≠ client), L5 (direct transfer). L6/L7 corroborate only. The funnel gains `N_ent`; caps apply per entity.

**2.4 Burner score (#9)** · S — explorer txlist: age at first feedback, txs before/after, feedback share of outbound txs; clone groups (same lifecycle signature).

**2.5 Evidence-Backed Share (#5)** · L — batch the existing file + payment loaders over all rows with a `feedbackURI` (cap, cache); levels L0 / L1 declared / L3 verified (reuse the `pay-*` checks with the payee rule fixed in §2.5); wash check (≥ 70% returns to the payer's entity within 7 d, or payer funded by OwnerSet); PayHist via EIP-3009 `AuthorizationUsed` (explorer `tokentx`/logs) worded as "has payment history". L2 when validation responses exist.

**2.6 Integrity grade + flag catalogue (spec §4)** · S — once 2.1–2.5 exist; each flag opens an evidence drawer.

**2.7 Liveness & registration validity (#19)** · M — `.well-known` domain check, endpoint probes through the relay (A2A card / MCP tool list parse), class Empty / Templated-inert / Thin-active / Live-verified. Probes are point-in-time from our relay; say so.

**2.8 Ownership-change carryover (#21)** · S — `Transfer` logs of the identity token; share of rating weight earned under previous owners.

**2.9 Validation metrics (#23)** · S — per chain where the registry exists: count, distinct validators, independence from OwnerSet.

**2.10 Cross-chain (#18)** · M — reciprocal `registrations[]` or 8004scan `cross_chain_links`; side-by-side robust scores; Div flag. Entity union across chains needs Phase 3.

### Phase 3 — Indexer (decision D1; ~4–6 weeks if yes)

Pipeline from spec §7.3 (index events → funding/traces → entity graph → kinds → units → metrics → daily snapshots → API with `formula_version`). It enables: full entity resolution, network-wide farm explorer / funder pages (spec §5), lockstep (#10), collusion rings / FRAUDAR (#15), sweepers (#14 network-wide), economic activity (#22), credibility (#13), robust vs raw leaderboard and rank shifts, score history. The SPA keeps working without it and switches to it the same way it switches between subgraph and RPC today.

### Removal list (all phases)

| Remove | Where | When |
|---|---|---|
| Cross-client `duplicate` rule | scores.ts, trustReport.ts, feedbackStats.ts, txChecks.ts | 0.1 |
| Ecosystem avg tile + histogram marker | ReputationPanel.vue, OverviewTab.vue | 0.5 |
| Positive rate, Bayesian prior 0 | scores.ts, MethodsTab.vue | 0.5 |
| Engagement-only / "starred" explanations | CompareTab.vue | 0.4 |
| Per-row `burst` / `monotonous` / `hyperactive` *weights* (keep flags) | scores.ts | 1.2 |
| Normal-approximation LCB | scores.ts, trustReport.ts, ReputationPanel.vue | 1.3 |
| Trust mass, exp(H) voices, duplicate concentration indices | scores.ts, txChecks.ts, variants/shared/metrics.ts | 1.5–1.6 |
| `rankScore` on raw average, `letterGrade` on trusted | variants/shared/metrics.ts + variants | 1.10 |
| By-tag weighted-average table | MethodsTab.vue | 1.8 |

---

## 6. Target formulas (v1, as adjusted here)

### 6.1 Normalisation

```
kind(tag1)  from registry; UNKNOWN otherwise
scale(tag1) inferred over all rows of that tag (agent-level now, chain-level with the indexer):
  values ⊆ {0,1} → binary · min < 0 → signed (S = max|v|, snapped to 1/5/10/100)
  max ≤ 5 → 5-pt · max ≤ 10 → 10-pt · max ≤ 100 → 0–100 · else → not a rating
client override: ≥ 5 values from one client that contradict the tag scale
r_f ∈ [0,1]; out of the inferred scale → excluded (counted, listed, never clamped)
```

### 6.2 Units and wallet aggregate

```
unit u = (client, tagGroup, 30-day window);  r_u = median r_f
r̄_c   = median r_u over c's units           (entity e in Phase 2)
W_c    = min(1, Σ_u 2^(−age_u / 90d)) · m_ev(c) · (1 − ownerLinked(c))
m_ev   = 1 (L0/L1) · 2 (L2) · 3 (L3)          Phase 1: m_ev = 1 for everyone
```

One independent, unverified, recent wallet = 1 unit of weight. Evidence raises weight instead of unverified feedback being shrunk to 0.03, so the prior and the weights share a scale (§3.2 point 1).

### 6.3 Robust score, interval, confidence

```
S  = (α0·μ0 + Σ W_c·r̄_c) / (α0 + Σ W_c),   α0 = 3, μ0 = 0.5
A  = α0·μ0 + Σ W_c·r̄_c;  B = α0·(1−μ0) + Σ W_c·(1−r̄_c)
CI80 = [BetaInv(0.10; A,B), BetaInv(0.90; A,B)]    (≈ interval; label it so)
Score = round(100·S),  ± = 100·half-width
Confidence: low if Σ W < 3 or N_wallets < 3 · high if Σ W ≥ 10, N_eff ≥ 5, Top1 < 0.3 · else medium
Unrated if no RATING units
I_max = max W_c / (α0 + Σ W) ≤ 3/(3+3) = 0.5 for a lone L3 wallet, ≤ 0.25 for a lone L0
```

Example: 50 independent 100s + one 20 → Σ W = 51, S = (1.5 + 50 + 0.2)/54 = 0.957, Beta(51.7, 2.3) → **96 ± 3, high**. One wallet with 3,453 *rating* records → Σ W = 1, S = (1.5 + 1)/4 = 0.625, Beta(2.5, 1.5) → **63 ± 28, low confidence, Top1 = 100%**. (If those records are telemetry, as on Celo #9308, the agent is Unrated.)

### 6.4 Cost to fake

```
raw mean:   v* = (n+1)·τ − n·m  (1 tx when unbounded);  k_raw = ceil(n·(τ−m)/(v_max−τ))
here:       X = (α0 + ΣW)·(τ − S)/(1 − τ);  k_free = ceil(X) unlinked unverified wallets,
            k_paid = ceil(X/3) verified-paid entities (Phase 2)
cost      = k · (median feedback fee + cost of an unlinked funding path)
```

The per-wallet cap and (Phase 2) entity merging are what keep `k_free` honest. Before Phase 2 the card says "assuming the wallets cannot be linked".

### 6.5 Parameters (published in the footer)

| Param | v1 | Note |
|---|---|---|
| Unit window | 30 d | |
| Half-life | 90 d | |
| α0 / μ0 | 3 / 0.5 | in wallet units |
| m_ev L0–1 / L2 / L3 | 1 / 2 / 3 | Phase 2 |
| Confidence | ΣW 3 / 10, N_eff 5, Top1 0.3 | |
| Funnel flag | N_fb/N_wallets ≥ 20 | |
| Concentration | Top1 0.5 warn / 0.8 high, N_eff < 3 | |
| Funding depth | 3 | Phase 2 |

---

## 7. Open decisions (yours)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Build an indexer (Phase 3)? It changes the product from explorer to analytics service: hosting, DB, keys. | Decide after Phase 2. Phase 0–2 already put the app past every competitor in the spec's survey. |
| D2 | Evidence weighting: spec's shrink-unverified (0.15 × 0.2) or this plan's boost-verified (1 / 2 / 3)? | Boost-verified. Shrinking makes ~99% of agents ≈ 50 and unrankable. |
| D3 | Keep a cross-wallet "same template" signal as a *flag* (never a weight)? | Yes, as #11 template uniformity. |
| D4 | 21 design variants: keep all on the new report, or prune? | Keep the classic + 3–5 strongest; every kept variant is a cost on every metric change (task 1.10). |
| D5 | Which mainnet chains get full Phase 2 tracing (explorer API quota)? | The chains with explorer APIs already configured (Ethereum, Arbitrum, Mantle, testnets) first; Base/BSC/Celo need keys or the relay. |
| D6 | Show 8004scan's score next to ours permanently? | Yes, on the Compare tab, with the corrected v5.2 explanation (it is the reference users know). |

---

## 8. Test & acceptance strategy

- **Golden cases** (new `src/data/reputation/*.test.ts`), each a fixture with expected outputs:
  1. 50 × 100 + 1 × 20 (agreement) → ≈ 96, high confidence.
  2. One wallet, 3,453 telemetry rows (Celo #9308 shape) → Unrated, telemetry panel shows 1 monitor.
  3. One wallet, 1,000 ratings spaced daily → Σ W ≤ 1, Top1 = 100%, funnel flag.
  4. Mixed kinds (ms, %, USD, −100, 0/1, 5-star) → only RATING kinds scored, OOR listed.
  5. Owner-funded reviewer (Phase 2) → weight 0, high flag with path.
  6. Payment-cited row where the payee is the owner rather than agentWallet → warn (not pass).
- Existing tests to rewrite: `scores.test.ts`, `feedbackStats.test.ts`, `trustReport.test.ts`, `txChecks.test.ts`, `insights.test.ts`, `variants/shared/metrics.test.ts`.
- Live spot checks before each phase ships: Celo #9308, one Base agent with funder clusters, one clean agent with many independent reviewers. Compare against 8004scan and QuickNode and write the differences down in the Compare tab notes.
- Every new number keeps the app's rule: a printed rule next to it, re-derivable from the rows on screen or the downloaded inputs.
