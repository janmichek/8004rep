# ERC-8004 Reputation Transparency — Metrics & Formulas Spec

*v0.1 · 24 Oct 2026 · scope: what an ERC-8004 reputation site should show, how each value is computed, ranked by usefulness*

---

## 0. TL;DR

Today's explorers mostly answer *"how many feedback records and what is their average?"*. That number is close to meaningless on ERC-8004 because:

- anyone can rate (only the owner/operator address is blocked), for fractions of a cent;
- one wallet can rate the same agent thousands of times;
- a fresh wallet per rating defeats "unique client" counts;
- `value` is an untyped `int128` — ratings, booleans, milliseconds and dollars get averaged together;
- almost no feedback is tied to a verifiable payment or task.

Your product's edge: **move the unit of counting from *feedback* → *wallet* → *independent entity*, weight entities by evidence, bound any single entity's influence, and show the evidence chain behind every flag.**

The seven values to ship first (ranked):

| # | Value | One-line meaning |
|---|---|---|
| 1 | **Independent Reviewers** (feedback → wallets → entities funnel) | "3,428 feedback = 1 wallet = 1 entity" |
| 2 | **Reviewer Concentration** (top-1 share, effective N) | How much of the reputation one actor controls |
| 3 | **Owner-Linked Share** | Feedback from wallets funded by / connected to the agent's owner (self-review via proxy) |
| 4 | **Coordinated-Cluster Share** | Feedback from reviewer wallets sharing funding provenance |
| 5 | **Evidence-Backed Share** | Feedback tied to a verified on-chain payment / task |
| 6 | **Robust Trust Score ± interval** (+ Inflation Gap vs raw mean) | The score after dedup, normalization, entity caps and evidence weighting |
| 7 | **Manipulation Cost** | $ needed to push the score past a threshold — on naive explorers vs. on yours |

---

## 1. What is broken today (evidence)

### 1.1 Empirical study (Xiong et al., arXiv 2606.26028, data to 13 May 2026, ETH/BSC/Base)

- Reviewers exhibiting coordinated Sybil behavior (shared first-funder): **73.5% / 59.2% / 90.6%** of reviewers on ETH / BSC / Base.
- After removing Sybil-flagged feedback, **15.8% / 77.9% / 86.8%** of rated agents have *no valid feedback left*.
- Feedback with neither payment proof nor task linkage: **98.7% / 100% / 99.3%**. On Base only 6.2% of reviewers have *any* x402 payment history, yet they are the only ones who could have paid.
- Median cost to push an agent across a score of 90: **one feedback** — $0.055 / $0.0042 / $0.0027 in gas. On Base that is ~259× below the median x402 value the agent earns.
- The on-chain `getSummary()` is an arithmetic mean → **breakdown point 0**: one crafted `value` sets the mean to anything. Even with clamping, the median agent flips with a single max rating.
- `value` semantics collapse: the same chain carries 0–100 ratings, 0–5 ratings, booleans, latency, revenue in USD (of 764 Base records above 100, 730 — 95.5% — are tagged `revenues`).
- Up to **1,181 records from a single reviewer→agent pair**; one operator funded 80 burner wallets through one contract; each wrote exactly 10 × score-100 feedbacks to 10 agents, and 79 of the 80 never transacted again.
- Cross-chain scores of the same agent are uncorrelated (Spearman ρ ≈ 0.05 BSC–Base).

### 1.2 What the existing sites show (observed 24 Oct 2026)

**8004scan (AltLayer)** — scoring `v5.2 / v5_leaderboard_policy`: Engagement 30% · Service 25% · Publisher 20% · Compliance 15% · Momentum 10%.
- Case: Celo agent #9308 (leaderboard rank #12, overall 92.67, "3,428 feedback"). Engagement explanation says *satisfaction from 3,428 users*. On-chain, the agent has **three clients**: `0x7111…2954` wrote 3,453 records and the other two wrote one each (99.9% from one wallet). The records are telemetry (`uptime`, `responseTime` = 53 ms, `successRate`), yet the agent shows "Average score 5.0/5.0 (100/100)".
- The old "43.1 weighted contributions" reading is a **legacy dimension sum** (Engagement 30 / Service 25 / Publisher 20 / Compliance 15 / Momentum 10) and no longer drives the headline. Its public API exposes the current policy: `merit = 0.7·proof_score + 0.3·support_score` (here `0.7·100 + 0.3·54.22 = 86.27`), then `total = floor + (ceiling − floor)·merit/100 = 78 + 17·0.8627 = 92.67`. The criticism stands, but precisely: `proof_score = 100` and the telemetry-driven support score come from one wallet, and the 70% proof weight lets that dominate.
- Homepage counters (same day): 1.53 M agents (+478k in 24 h), 2.36 M "unique wallets" (+921k in 24 h). Counts moving this fast can't be read as adoption or as reviewer counts.
- Good parts worth matching: endpoint health checks (A2A/MCP probing), metadata validation, score history.

**QuickNode ERC-8004 Explorer — formula v1.4 (fully published)**
`score = round(0.50·feedback + 0.15·validation + 0.20·sybil_resistance + 0.15·reliability)` (validation weight redistributed when absent).
- `feedback` = mean of non-revoked values from a tag whitelist, values outside [0,100] excluded; per-tag publisher concentration cap (agent >30% of a tag's global volume → its rows for that tag dropped); variance discount (σ<1 over ≥20 rows → ×0.25). Its whitelist includes `responseTime`, `uptime` and `successRate`, so 53 ms passes the [0,100] filter and is averaged as if it were a rating.
- `sybil_resistance = 100 · unique_clients / non_revoked_feedback` → **defeated by one fresh wallet per rating** (their own FAQ names "~1500 unique addresses each emitting one helpful=100" as the canonical attack).
- `reliability = 100 · (1 − revoked/total)`; confidence by count (<5 low, 5–49 medium, ≥50 high).
- Good parts: reproducible, versioned, signals block shows excluded tags.

**8004agents.ai** — Reputation /100, feedback count, validation count; a *Trust* tab lists validators vs reviewers with avg review/validation. Case: Ethereum agent #52158 shows "1/100 — Needs Improvement" from **31 feedbacks by 1 reviewer**, where `value = 1` under tags like `review:submission` / `acceptance-v2` looks like a binary *pass* flag rendered as a 1-out-of-100 rating → the semantic-collapse problem in the UI.

**TrustLayer (API/skill)** — returns `sybil_risk`, `anomaly_flags` (review_bombing, single_agent_reviewers, reputation_laundering…), `reviewer_weighted_score`, cross-chain divergence; lists six detection methods (reviewer overlap, one-to-one patterns, wallet age, cross-chain identity, timing anomalies, tag spam); its docs don't publish the formulas or thresholds.

**The gap you can own:** nobody shows the entity funnel, owner-linked proxies, *verified* evidence, bounded-influence scoring with an interval, the manipulation price, and an evidence drawer explaining each flag — with published formulas.

---

## 2. Layer 0 — foundations every metric depends on

None of the metrics below are honest without these four steps. Build them first.

### 2.1 Notation

```
a            agent  (chainId, registry, agentId)
c            client address (msg.sender of giveFeedback)
f            feedback record = (a, c, idx, v, d, tag1, tag2, endpoint, uri, hash, block, t, tx)
ṽ_f          normalized value = v / 10^d
F_a          non-revoked feedback of agent a
C_a          distinct clients of a
e = E(c)     entity (cluster of addresses believed to be one actor) — §2.4
E_a          distinct entities that rated a
owner(a), wallet(a), ops(a)   owner, agentWallet, approved operators at block of f
```

### 2.2 Tag → kind registry + scale inference

Classify each feedback into a **kind**; only `RATING` kinds enter quality scores.

```
KIND(tag1) from a curated map (case-insensitive, trim, camel/snake unified):
  RATING      starred, quality, trust, satisfaction, helpful, review, rating, personality ...
  BINARY      reachable, ownerVerified, correctness, verified, pass, acceptance ...
  PERCENT     uptime, successRate
  LATENCY_MS  responseTime, latency
  CURRENCY    revenues, revenue, volume
  SIGNED_PCT  tradingYield (tag2 = period)
  UNKNOWN     anything else

Per (tag1, client) infer the scale from that client's observed values:
  values ⊆ {0,1}                  → binary
  max ≤ 5   (and min ≥ −5)        → 5-point
  max ≤ 10                        → 10-point
  max ≤ 100 (and min ≥ 0)         → 0–100
  else                            → unbounded metric (never a rating)

Normalized rating r_f ∈ [0,1]:
  5-point     r = clamp(ṽ, 0, 5) / 5          (negative 5-star ⇒ treat ṽ<0 as 0, keep "negative" flag)
  10-point    r = ṽ / 10
  0–100       r = ṽ / 100
  binary      r = ṽ   (only if KIND = RATING-like "pass/fail"; otherwise telemetry)
  out of range for its inferred scale → EXCLUDED (count it, show it, never clamp)
```

Why per-client inference: the paper shows the same tag (`review`) used as 0–5 by some raters and 0–100 by others.

### 2.3 Rating units (dedup)

```
unit u = (a, c, tagGroup, window)   window = 30 days
r_u    = median of r_f for f in the unit
m_{c,a} = # non-revoked records from c to a  (cross-check: getLastIndex(a,c) − revoked)
```
A wallet that rates daily for a year contributes ≤ 12 units, and §2.4 + metric #6 cap the entity's total weight anyway.

### 2.4 Entity resolution (the core)

Build an address-linkage graph over all reviewers (and owners, agent wallets, validators), then take components.

```
firstFunder(x)  = sender of the earliest inbound native-value transfer to x
                  (include internal transfers via traces; if the sender is a contract,
                   resolve to the EOA that triggered it, as the paper does)
root(x)         = follow firstFunder up to depth D = 3, stop at an INFRA address
INFRA           = CEX hot wallets, bridges, faucets, ERC-4337 paymasters/bundlers,
                  EIP-7702 relayers, routers, ACP escrow — from label lists + heuristics
                  (an address that funded > 5,000 unrelated wallets is INFRA by default)

Link edges between addresses x, y (weight):
  L1  root(x) = root(y), root ∉ INFRA                                   1.0
  L2  same non-INFRA gas sponsor (tx.from ≠ clientAddress) for both     0.8
  L3  same sweep destination (largest / last outbound value transfer)   0.9
  L4  same CEX deposit address (deposit-address reuse heuristic)        1.0
  L5  direct value transfer x↔y (non-dust, either direction)            0.9
  L6  identical lifecycle signature in the same 1 h window (metric #9)       0.5
  L7  identical off-chain feedback template (same JSON skeleton hash,
      same feedbackURI host+path pattern) in the same 1 h window        0.4
  L8  same address/root seen on another chain                           1.0 (union across chains)

Entity = connected components over edges with cumulative weight ≥ θ = 0.8
Components > 200 addresses → split with Louvain modularity (as the Arbitrum
airdrop sybil pipeline did) and keep the split only if each part is internally dense.
```

Each entity gets a **role label** shown in the UI: `independent rater`, `automated monitor` (telemetry tags, regular cadence), `platform/relayer` (one address rating many agents for a marketplace), `validator`, `farm` (metrics #3–#9 signals), `owner-linked`.

---

## 3. Metrics, ranked by usefulness

Legend — Usefulness ★1–5 (signal value × how often it changes a decision) · Effort S/M/L.

### Summary table

| Rank | Metric | Catches | Usefulness | Effort |
|---|---|---|---|---|
| 1 | Independent Reviewers funnel | Repeat raters, fresh-wallet farms | ★★★★★ | M |
| 2 | Reviewer Concentration (Top-1, N_eff) | One actor owning the score | ★★★★★ | S |
| 3 | Owner-Linked Share | Self-review via proxy wallets | ★★★★★ | M |
| 4 | Coordinated-Cluster Share | Sybil rings with shared funding | ★★★★★ | M |
| 5 | Evidence-Backed Share | Ratings without real interaction; wash payments | ★★★★★ | L |
| 6 | Robust Trust Score ± CI + Inflation Gap | Everything above, as one number | ★★★★★ | M |
| 7 | Manipulation Cost / Value-at-Stake | How cheap the score is to fake | ★★★★☆ | S |
| 8 | Repeat-Rating Intensity | Same wallet rating again and again | ★★★★☆ | S |
| 9 | Burner-Wallet Score | Short-lived single-purpose reviewers | ★★★★☆ | M |
| 10 | Burst & Lockstep | Bought ratings arriving together | ★★★★☆ | M |
| 11 | Template Uniformity | Scripted identical values/tags | ★★★★☆ | S |
| 12 | Semantic Validity | Metrics averaged as ratings | ★★★★☆ | S |
| 13 | Reviewer Credibility | Weighting reviewers by track record | ★★★☆☆ | L |
| 14 | Queue-Sweep / Fan-out | Wallets spraying many agents | ★★★☆☆ | S |
| 15 | Collusion & Reciprocity | Agent owners rating each other | ★★★☆☆ | M |
| 16 | Revocation Patterns | Revoke-and-replace, critic suppression | ★★★☆☆ | S |
| 17 | Review-Bombing | Coordinated negative attacks | ★★★☆☆ | S |
| 18 | Cross-Chain Divergence | Laundering a good chain's score | ★★★☆☆ | M |
| 19 | Liveness & Registration Validity | Placeholder / dead agents | ★★★☆☆ | M |
| 20 | Owner Portfolio & Sibling Overlap | Farms of templated agents | ★★★☆☆ | M |
| 21 | Ownership-Change Carryover | Buying a reputable agent NFT | ★★☆☆☆ | S |
| 22 | Economic Activity | Real paying users vs ratings | ★★★☆☆ | L |
| 23 | Validation Metrics | Self-selected validators | ★★☆☆☆ | S |
| 24 | Operational Telemetry Panel | Uptime/latency by independent monitors | ★★☆☆☆ | S |
| 25 | Responsiveness | Owner replies to complaints | ★☆☆☆☆ | S |

---

### 1. Independent Reviewers (feedback → wallets → entities) · ★★★★★ · M

**Answers:** how many *independent* actors actually rated this agent.

```
N_fb      = |F_a|
N_wallets = |C_a|
N_ent     = |{ E(c) : c ∈ C_a, E(c) not owner-linked }|
N_ent_ev  = entities with ≥ 1 evidence-backed unit (L3/L2, #5)
```
**Show as:** a funnel bar — `3,428 feedback → ≈1 wallet (99.9%) → 1 entity (automated monitor) → 0 evidence-backed`.
**Flag:** `N_fb / N_ent ≥ 20` → "Feedback volume is not reviewer volume".
**Gaming:** fresh wallets inflate N_wallets but collapse in N_ent if funding links exist; unlinked wallets still have low weight via #5 and #13.

### 2. Reviewer Concentration · ★★★★★ · S

**Answers:** does one actor (or a few) control the reputation?

```
s_e        = W_e / Σ_e W_e          (share of rating weight, W_e from #6; also compute on raw counts)
Top1(a)    = max_e s_e
Top3(a)    = sum of 3 largest s_e
HHI(a)     = Σ_e s_e²
N_eff(a)   = 1 / HHI(a)             (effective number of equal reviewers)
Gini(a)    = Σ_i Σ_j |x_i − x_j| / (2 n² x̄)   over per-entity feedback counts
```
**Flag:** `Top1 ≥ 0.5` (warn), `Top1 ≥ 0.8` (high), `N_eff < 3` → "reputation rests on < 3 independent voices".
**Show as:** stacked bar of top entities + "others".

### 3. Owner-Linked Share (self-review via proxy) · ★★★★★ · M

**Answers:** how much feedback comes from wallets connected to the agent's own owner? The contract only blocks `owner`/`operator` *addresses*; funding a new wallet bypasses it.

```
OwnerSet(a) = {owner(a), wallet(a)} ∪ ops(a) ∪ {owners/wallets of other agents with same owner}
            ∪ E(owner(a)) ∪ E(wallet(a))

ownerLinked(c, a) = 1 if any:
   E(c) ∈ entities of OwnerSet(a)
   funding-path distance(c, OwnerSet(a)) ≤ 2 (either direction, ignoring INFRA)
   c received ≥ $X (default $1 equiv.) from OwnerSet(a) within 30 d before its feedback
   c is the agentWallet of a sibling agent (same owner)

OLS(a) = Σ_{f∈F_a} ownerLinked(c_f, a) / |F_a|          (also weight-based version)
```
**Flag:** any owner-linked rating unit → red flag with the funding path shown (`owner → 0xab… → reviewer`). Owner-linked weight is set to 0 in the score.
**Note:** owner-linked *telemetry* (self-monitoring) is not malicious; label it, exclude it from quality.

### 4. Coordinated-Cluster Share · ★★★★★ · M

**Answers:** is the agent's support coming from a Sybil cluster rather than many independent users?

```
For agent a: cluster share = feedback from entities whose size ≥ 2 wallets AND who
             are flagged as farm (burner #9, sweep #14, lockstep #10, template #11)

CCS(a) = Σ_{f: E(c_f) ∈ FarmEntities} 1 / |F_a|

Funding-root view (paper method): group a's reviewers by root(c).
RootShare(a) = max_root (# reviewers of a with that root) / |C_a|
```
**Flag:** `CCS ≥ 0.35` warn, `≥ 0.7` high; `RootShare ≥ 0.5 with |C_a| ≥ 5` high.
**Show as:** funding tree graphic — root funder → N wallets → which agents they rated (most persuasive UI element you can build).
**Paper calibration:** removing first-funder-linked reviewers left most Base/BSC agents with no feedback at all — expect high base rates, so default to "pattern" language, not "fraud".

### 5. Evidence-Backed Share · ★★★★★ · L

**Answers:** what fraction of feedback is tied to a real, verifiable interaction?

```
Evidence level per feedback f:
 L3 VERIFIED-PAID  proofOfPayment.txHash (or x402 nonce → AuthorizationUsed) exists on chainId,
                   succeeded, payer ∈ E(c), payer ∉ OwnerSet(a),
                   payee = wallet(a) at that block (wallet held by exactly one agent),
                   OR payee = ACP escrow and the job's provider maps to a,
                   amount ≥ p_min, t_pay ≤ t_f ≤ t_pay + 30 d, and NOT wash (below)
 L2 VERIFIED-TASK  references a ValidationResponse for a (requestHash) from an
                   independent validator, or a signed task receipt (future A2A extension)
 L1 DECLARED       off-chain file has proofOfPayment / a2a.taskId / mcp.tool but it
                   does not verify
 L0 NONE

Reviewer-level necessary condition (paper): H(c) = 1 if c ever authorized an EIP-3009
USDC transfer (AuthorizationUsed with authorizer = c). H(c)=0 ⇒ no x402 payment possible.

Wash-payment check (attackers will pay their own agent to manufacture L3):
  wash(f) = 1 if within 7 d of the payment ≥ 70% of the amount flows back from
            wallet(a)/OwnerSet(a) to E(c), OR c was funded by OwnerSet(a) within 7 d
            before paying

EBS(a)  = |{f : level ≥ L3}| / |F_a|           (headline)
EBS2(a) = |{f : level ≥ L2}| / |F_a|
PayHist(a) = |{c ∈ C_a : H(c)=1}| / |C_a|
```
**Show as:** stacked bar L3 / L2 / L1 / L0 + "x% of reviewers have ever made an x402 payment".
**Why ranked high:** this is the only signal that raises the attacker's cost from gas to real money; everything else is detection after the fact.

### 6. Robust Trust Score ± interval (+ Inflation Gap) · ★★★★★ · M

**Answers:** the score after dedup, normalization, entity caps, evidence and credibility weighting — with honest uncertainty.

```
1. Rating units u (§2.3) from KIND = RATING only, r_u ∈ [0,1]
2. Entity aggregate for agent a:   r̄_e = median{ r_u : u from entity e }
3. Entity weight — one independent, unverified, recent wallet = 1. Evidence
   raises weight instead of unverified feedback being shrunk, so weights and
   the prior share one scale:
     W_e = min(1, Σ_u w_time(u)) · m_ev(e) · w_cred(e) · (1 − ownerLinked(e))
     w_time(u) = 2^(−age_u / H),  H = 90 d
     m_ev(e)   = 1 if L0/L1 · 2 if L2 · 3 if L3
     w_cred(e) = clamp(Credibility(e), 0.2, 1.0)          (#13; default 1.0, only a sybil penalty lowers it)
4. Bayesian shrinkage (bounded influence):
     S(a) = (α0·μ0 + Σ_e W_e·r̄_e) / (α0 + Σ_e W_e)
     α0 = 3 pseudo-weight, μ0 = 0.5 (neutral; or chain median of L3-backed entities)
5. Interval (80%): Beta(A, B) with
     A = α0·μ0 + Σ W_e·r̄_e ,  B = α0·(1−μ0) + Σ W_e·(1 − r̄_e)
     CI = [BetaInv(0.10; A,B), BetaInv(0.90; A,B)]
6. Display: Score = round(100·S),  "± " = half-width of CI ×100
7. Confidence:  n_w = Σ_e W_e
     low < 3 full votes or < 3 wallets  ·  medium otherwise
     high ≥ 10 full votes and N_eff ≥ 5 and top-1 share < 0.3
8. Bounded influence:  I_max = max_e W_e / (α0 + Σ_e W_e)   ≤ 3/(3+3) = 0.5 for a lone L3 wallet, ≤ 0.25 for a lone unverified one

Raw baseline (what naive explorers show):
     S_raw(a) = mean of ṽ over all non-revoked F_a, all clients, all tags
               (= getSummary with every client) — and the 0–100-only variant
Inflation Gap  Δ(a) = S_raw_0–100 − Score
```
**Show as:** big number with interval and confidence chip, and right next to it: *"Raw average 99 · Inflation gap +38"*.
**Unrated state:** no RATING units → show "Unrated — telemetry only" rather than a number (e.g., the 8004scan case in §1.2 would render as *Unrated · 1 monitor · uptime 100% · 53 ms*).
**Why Bayesian, not mean:** the mean has breakdown point 0; here each entity's pull is capped (≤ 25% even for a perfect, credible, paid reviewer when it is the only one), and new agents start near "unknown", not 0 or 100.

### 7. Manipulation Cost & Value-at-Stake · ★★★★☆ · S

**Answers:** how much would it cost to fake this agent's score past a trust threshold τ (default 0.9)?

```
On raw-mean explorers (Appendix F, Eqs. 14–15 for the crafted-value form; the paper does not state Eq. 3–4 for this):
   single unbounded record:  v* = (n+1)·τ − n·m              (always 1 tx)
   with values clamped:      k_raw = ceil( n·(τ − m) / (v_max − τ) )
   Cost_raw = k_raw · gas_median(chain)

On your robust score:
   W' = α0 + Σ_e W_e
   X  = W'·(τ − S) / (1 − τ)          weight an attacker must add at r = 1
   unpaid fresh entities:   w_new = m_ev(L0) = 1
   paid (L3) fresh entities: w_new = m_ev(L3) = 3
   k_free = ceil(X / 1),  k_paid = ceil(X / 3)
   Cost_free ≈ k_free · (gas + c_wallet)              c_wallet = cost of an unlinked funding path
   Cost_paid ≈ k_paid · (gas + c_wallet + p_min)

Value-at-stake ratio:  VSR(a) = x402_volume_30d(a) / Cost_raw
```
**Example:** agent with Σ W_e = 5, S = 0.60, τ = 0.90 → W' = 8, X = 24 → 800 unlinked unpaid entities or 120 paid ones, versus **1 transaction** on a raw mean.
**Show as:** "Faking a 90 here: ~$0.003 on raw-average explorers · ≥ 120 independent paid wallets on this site."

### 8. Repeat-Rating Intensity · ★★★★☆ · S

```
m_{c,a}        records from c to a (non-revoked)
MaxPair(a)     = max_c m_{c,a}
RepeatShare(a) = 1 − |C_a| / |F_a|          (= 1 − QuickNode's sybil_resistance)
Paper group form: RS(g) = 1 − |P_g| / N_g   with P_g = distinct (reviewer, agent) pairs
```
**Flag:** `MaxPair ≥ 20` on RATING tags, or `RepeatShare ≥ 0.8` with `|F_a| ≥ 20`.
**Show:** histogram "records per reviewer"; tag the repeaters (monitor vs rater).

### 9. Burner-Wallet Score (reviewer lifecycle) · ★★★★☆ · M

```
Per reviewer c (per chain):
  age_fb   = t(first feedback) − t(first tx or first funding)
  pre      = # txs before first feedback
  post     = # txs after last feedback (evaluate only if ≥ 14 d elapsed)
  fb_frac  = feedback txs / all outbound txs
  fund_ratio = native received / gas spent

  B(c) = 0.25·[age_fb < 3 d] + 0.25·[post = 0] + 0.25·[fb_frac ≥ 0.8] + 0.25·[fund_ratio ≤ 3]
  burner(c) ⇔ B(c) ≥ 0.75

Lifecycle signature: sig(c) = (pre, #feedback, post, feedbackNoncesContiguous?)
Clone group = ≥ 5 reviewers with identical sig in the same 24 h (paper: 56 wallets with
   8 pre-txs → 10 contiguous feedback nonces → no further activity)

BurnerShare(a) = rating weight from burners / total rating weight
```
**Flag:** `BurnerShare ≥ 0.5`.

### 10. Burst & Lockstep (temporal) · ★★★★☆ · M

```
Daily counts x_d for agent a (trailing 60 d):
  burst(a,d) = x_d / (median(x_{d−30 … d−1}) + 1)
  BurstFlag  : max_d burst ≥ 10 and x_d ≥ 20,  or ≥ 50% of lifetime feedback in any 24 h
  NewWalletBurst = share of burst-window feedback from wallets aged < 7 d

Same-block clustering:
  SBS(a) = share of F_a in blocks containing ≥ 3 feedbacks for a from different clients

Robotic cadence per reviewer (≥ 10 records):
  CV(c) = σ(Δt) / μ(Δt);  CV < 0.15 → "scripted" (fine for monitors, suspicious for ratings)

Lockstep (CopyCatch-style), across agents:
  find sets U (≥ 5 reviewers) × A (≥ 3 agents) where every u ∈ U rated ≥ 80% of A
  within Δt = 1 h; LockstepShare(a) = feedback of a from members of such U
```
Inter-rating-time anomaly vs population can be scored BIRDNEST-style (Bayesian surprise of a reviewer's inter-arrival and rating distribution vs global).

### 11. Template Uniformity · ★★★★☆ · S

```
Over a's rating units (and per entity group g):
  p(x)     empirical distribution of r rounded to 0.01
  H_score  = −Σ p(x)·log2 p(x)          D_score = 2^H_score   (effective # distinct values)
  D_tag    = 2^H over (tag1, tag2) pairs
  σ_r      = std dev of r
  ExtremeShare = share of r ≥ 0.99 or ≤ 0.01
  JSD(a)   = Jensen–Shannon divergence of a's 10-bin histogram vs. chain-wide histogram
```
**Flag:** `σ_r < 0.01 with n ≥ 20` (QuickNode's zero-variance signature), `D_score ≤ 1.5 with ≥ 20 entities`, `ExtremeShare ≥ 0.9 with N_ent ≥ 10`. Paper case: one BSC group used score 70 for 73% of 21,863 records.

### 12. Semantic Validity · ★★★★☆ · S

```
Conformity(a) = share of F_a whose tag maps to a known KIND and whose value fits its scale
OOR(a)        = # records outside inferred scale (never clamped, listed)
MixFlag(tag)  = same tag used with ≥ 2 inferred scales across clients
Telemetry share = share of F_a with KIND ∈ {PERCENT, LATENCY_MS, CURRENCY, BINARY-telemetry}
```
**Show as:** three tabs — *Ratings* (score inputs) · *Telemetry* (#24) · *Custom/Unknown* (displayed raw, never averaged).

### 13. Reviewer Credibility · ★★★☆☆ · L

REV2-style fairness/goodness/reliability, adapted to [0,1], plus behavioral priors.

```
G(a)   = (β·μ_G + Σ_c R(c,a)·r_{c,a}) / (β + Σ_c R(c,a))                 goodness of agent
R(c,a) = (γ1·F(c) + γ2·(1 − |r_{c,a} − G(a)|)) / (γ1 + γ2)               reliability of a rating
F(c)   = (α·μ_F + Σ_a R(c,a)) / (α + |A_c|)                              fairness of reviewer
iterate to convergence; init F = R = 1, G = 0.5; priors α = β = 2, γ1 = γ2 = 1

Credibility(e) = F(e) · (1 − B(e)) · (1 + 0.5·[has L3 history]) · (1 − farmFlag(e))   → clamp [0.2, 1]
```
**Caveat:** a cluster that always rates 100 where consensus is ~100 looks "fair" in REV2 — credibility only works *after* entity collapsing (§2.4). Optional: EigenTrust over agent-wallet reviewers, `t = (1−d)·Cᵀ·t + d·p`, with pre-trust `p` on verified payers/validators.

### 14. Queue-Sweep / Reviewer Fan-out · ★★★☆☆ · S

```
Per entity e:  N_e = # records, A_e = # distinct agents
Fanout(e) = A_e / N_e         (paper Eq. 20)
RS(e)     = 1 − |P_e| / N_e   (paper Eq. 22)
Sweeper   : A_e ≥ 50 and Fanout ≥ 0.8 and D_score(e) ≤ 2 and D_tag(e) ≤ 2
Targeter  : A_e ≤ 3  and RS(e) ≥ 0.7
SweepShare(a) = feedback of a from sweepers
```
Distinguish legit platform reviewers (e.g., a marketplace's QA wallet) via role labels and published intent; still cap them as one entity.

### 15. Collusion & Reciprocity · ★★★☆☆ · M

```
Actor graph: node = entity; edge e1 → e2 if e1 rated an agent owned by e2 (weight = W)
Reciprocity(a) = share of a's rating weight from entities whose agents are rated by owner(a)'s entity
Ring       : strongly connected component of size ≥ 3 with ≥ 80% positive ratings
Dense block: FRAUDAR on the reviewer × agent bipartite graph,
             g(S) = Σ_{edges in S} w_ij / |S|,  column weights w_ij = 1 / log(deg_j + 5)
RingShare(a) = weight from entities in a ring/dense block that includes owner(a)'s entity
```

### 16. Revocation Patterns · ★★★☆☆ · S

```
RevRate(a)         = revoked / total
RevokeReplace(a)   = # cases where c revokes r ≤ 0.4 and within 7 d gives r ≥ 0.8 to same a
NegRevokedShare(a) = revoked negatives / all negatives   (high ⇒ pressure on critics)
```

### 17. Review-Bombing · ★★★☆☆ · S

```
NegBurst(a,d) = negatives_d / (median negatives over trailing 30 d + 1)
BombFlag      : NegBurst ≥ 10, ≥ 10 negatives, and ≥ 70% of them from entities < 7 d old
               or one farm cluster
```
Entity caps already neutralize most of it; the flag explains score movement to users.

### 18. Cross-Chain Divergence · ★★★☆☆ · M

```
Linked identities: registrations[] entries count as verified only if reciprocal
  (each chain's file lists the other) or same owner / same verified .well-known domain
Div(a) = |Score(chain1) − Score(chain2)|
Flag   : Div ≥ 25 with ≥ medium confidence on both; or all evidence on the chain with fewer entities
Shared entities across chains are unioned (L8), so a farm can't count twice.
```

### 19. Liveness & Registration Validity · ★★★☆☆ · M

```
Checks: URI set · resolves · type == ".../eip-8004#registration-v1" · name & description ·
        ≥ 1 service · own endpoint probes (7-day success rate, p50 latency) · A2A card / MCP
        tools parse · endpoint-domain verified via https://{domain}/.well-known/agent-registration.json
        listing this agentRegistry+agentId · agentWallet set · active flag

Class (paper typology):
  Empty            no/unresolvable URI or not compliant
  Templated-inert  compliant, never maintained after mint (no update > 1 d after mint)
  Thin-active      maintained but no working endpoint
  Live-verified    compliant + healthy endpoint + verified domain
```
Paper baseline: only 3% / 4% / 15% of ETH / BSC / Base agents had a valid file with a service.

### 20. Owner Portfolio & Sibling Overlap · ★★★☆☆ · M

```
Portfolio(owner)  = # agents, # minted in batch txs, description near-duplicates
                    (MinHash Jaccard ≥ 0.9 ⇒ templated)
SiblingOverlap(a) = max_{a' same owner} |E_a ∩ E_a'| / |E_a ∪ E_a'|
```
**Flag:** templated portfolio + `SiblingOverlap ≥ 0.5` + high scores ⇒ "reputation farm".

### 21. Ownership-Change Carryover · ★★☆☆☆ · S

```
RepAgeCurrentOwner = now − t(last secondary Transfer)
Carryover(a)       = rating weight earned before last transfer / total rating weight
```
Show "87% of this reputation was earned under a previous owner". Optionally halve pre-transfer weight (agentWallet is cleared on transfer per spec, so payment history also resets).

### 22. Economic Activity · ★★★☆☆ · L

```
Vol30(a)  = Σ x402 USDC received at wallet(a) where the wallet is held by exactly one agent
            at that block (paper attribution rule), + ACP jobs if provider ↦ a
Payers(a) = # payer entities, excluding OwnerSet(a) and wash-flagged
PayerReviewerOverlap = |E_reviewers ∩ E_payers| / |E_reviewers|
VSR(a)    = Vol30(a) / Cost_raw(a)          (#7)
```
Paper notes attribution is a lower bound (shared wallets, escrow routing) — label it "attributable volume".

### 23. Validation Metrics · ★★☆☆☆ · S

```
#validations, #distinct validator entities, mean response (0–100), pass rate (response ≥ 80),
last update; Independence = share of responses from validators ∉ OwnerSet(a) and not
funded by it. Requests are made by the owner, so validators are self-selected →
weight a validator by its own history (# agents validated, disagreement rate).
```
Mainnet validation activity is still sparse; show it, but keep its weight low until it isn't.

### 24. Operational Telemetry Panel · ★★☆☆☆ · S

```
For tags uptime / successRate / responseTime / reachable / liveness:
  per monitor entity: latest, 30-d p50/p95; MonitorDiversity = # independent monitor entities;
  Disagreement = max − min across monitors; compare with your own probes
```
Never fold these into the quality score; they answer "is it up", not "is it good".

### 25. Responsiveness · ★☆☆☆☆ · S

```
ResponseRate(a) = negatives with an appendResponse from owner/wallet(a) / all negatives
ResponseLag     = median(t_response − t_feedback)
ThirdPartyTags  = responses from known aggregators marking feedback as spam
```

---

## 4. Integrity grade & flag list

A letter grade next to the score, so users read the score in context.

```
A  N_ent ≥ 10, EBS ≥ 0.30, OLS = 0, CCS < 0.20, Top1 < 0.30
B  N_ent ≥ 5,  OLS < 0.05, CCS < 0.35, Top1 < 0.50
C  N_ent ≥ 3,  OLS < 0.10, CCS < 0.50
D  any other agent with ≥ 1 rating unit
F  OLS ≥ 0.30 or CCS ≥ 0.80 or BurnerShare ≥ 0.80 or confirmed wash payments
—  Unrated (no rating units)
```

Flag catalogue (severity · trigger · evidence shown):

| Flag | Sev | Trigger | Evidence drawer |
|---|---|---|---|
| owner_linked_reviews | High | OLS > 0 | funding path owner → … → reviewer |
| sybil_cluster | High | CCS ≥ 0.7 or RootShare ≥ 0.5 | funding tree, # wallets, agents touched |
| wash_payments | High | any wash(f) | payment and return-flow txs |
| single_actor_reputation | High | Top1 ≥ 0.8 | top entity, # records |
| burner_reviewers | Med | BurnerShare ≥ 0.5 | lifecycle table |
| burst | Med | BurstFlag | daily chart with burst window |
| lockstep_group | Med | LockstepShare ≥ 0.3 | U × A matrix |
| template_uniform | Med | #11 triggers | value/tag histograms |
| repeat_rater | Med | MaxPair ≥ 20 | per-reviewer counts |
| semantic_mismatch | Low | Conformity < 0.5 | mixed-scale examples |
| cross_chain_divergence | Med | Div ≥ 25 | side-by-side scores |
| reputation_carryover | Low | Carryover ≥ 0.5 | transfer tx |
| placeholder_agent | Low | Empty / Templated-inert | probe results |

Wording rule: say "pattern consistent with…", always show the evidence, and let agents respond (they can `appendResponse`, and you can surface it).

---

## 5. Other pages worth building

**Reviewer page** — entity membership & funding root, role label, burner score, records / agents / fan-out, D_score / D_tag, credibility F(c), evidence levels of its feedback, agents it rated (with owner links), timeline.

**Funder / cluster page ("farm explorer")** — root address, # reviewer wallets funded, # agents touched, total records, score modes, tag templates, active window, which leaderboard agents depend on it (share of their weight). This is the page that will get shared on X.

**Ecosystem dashboard** — per chain: live vs placeholder agents; feedback by evidence level; share of feedback from flagged clusters; top 20 funder roots by agents touched; new reviewer wallets/day; tag vocabulary and scale conformity; median manipulation cost; "raw leaderboard vs robust leaderboard" rank shifts.

---

## 6. UI notes (agent page)

1. Header: **Robust 61 ± 12 · medium confidence · Integrity C** — beside it, muted: *raw avg 99 (+38 inflation)*.
2. Funnel bar: feedback → wallets → entities → evidence-backed.
3. Concentration bar (top entities) + funding tree toggle.
4. Evidence stacked bar (L3/L2/L1/L0) + payer overlap.
5. Tabs: Ratings · Telemetry · Custom/Unknown · Validations.
6. Timeline: daily feedback, bursts highlighted, new-wallet share overlay.
7. Flags list with evidence drawers.
8. "Price to fake" card (#7).
9. Footer: `formula_version`, parameter set, "download inputs (JSON)" so anyone can recompute — QuickNode's best idea, keep it.

---

## 7. Implementation notes

### 7.1 Data you need

| Source | Fields | Used by |
|---|---|---|
| Identity: `Registered`, `Transfer`, `URIUpdated`, `MetadataSet(agentWallet)` | owner, URI history, wallet history, transfers | 3, 19–21, 22 |
| Reputation: `NewFeedback` | agentId, clientAddress, feedbackIndex, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash | all |
| Reputation: `FeedbackRevoked`, `ResponseAppended` | revocations, responses | 16, 25 |
| Validation: `ValidationRequest`, `ValidationResponse` | validator, response, tag | 5 (L2), 23 |
| Tx receipts | tx.from (relayer), gas, block, timestamp, client nonce | 2.4 (L2), 7, 9, 10 |
| Native transfers + traces per address | first funder, sweeps, tx counts, code size / 7702 delegation | 2.4, 3, 9 |
| USDC `AuthorizationUsed` + `Transfer`; ACP `JobCreated` / `PaymentReleased` | x402 payments, payers | 5, 22 |
| Off-chain | registration file, feedback file, endpoint probes, `.well-known` | 5 (L1), 12, 19 |
| Labels | CEX, bridges, faucets, paymasters, relayers, escrow | 2.4 INFRA |

Cross-check derived counts with `getClients(agentId)` and `getLastIndex(agentId, client)`.

### 7.2 Default parameters

| Param | Default | Notes |
|---|---|---|
| Rating unit window | 30 d | per (agent, client, tagGroup) |
| Time-decay half-life H | 90 d | |
| Prior α0 / μ0 | 3 / 0.5 | μ0 can be chain median of L3 entities |
| w_ev L3/L2/L1/L0 | 1.0 / 0.6 / 0.3 / 0.15 | |
| w_cred floor | 0.2 | |
| Entity link threshold θ | 0.8 | |
| Funding depth D | 3 | stop at INFRA |
| INFRA auto-threshold | funded > 5,000 wallets | plus label lists |
| p_min for L3 | $0.01 equiv. | raise per agent price |
| Burst ratio / min count | 10 / 20 | |
| Lockstep U / A / Δt | 5 / 3 / 1 h | |
| Burner threshold | B ≥ 0.75 | |

Calibrate every threshold against a labeled sample (the paper's case studies are a good seed set) and publish precision estimates.

### 7.3 Pipeline

1. Index events (reorg-safe) → 2. resolve funding/traces for every new reviewer, owner, wallet, validator → 3. update entity graph (incremental union-find; nightly Louvain on large components) → 4. classify tags/scales → 5. build rating units → 6. compute metrics + flags → 7. compute score, CI, cost → 8. snapshot daily (score history) → 9. expose API with `formula_version` and full inputs.

---

## 8. Sources

- Xiong et al., *Can Trustless Agents Be Trusted? An Empirical Study of the ERC-8004 Decentralized AI Agent Ecosystem*, arXiv 2606.26028 — https://arxiv.org/abs/2606.26028
- ERC-8004 specification — https://eips.ethereum.org/EIPS/eip-8004
- QuickNode ERC-8004 Explorer, reputation formula v1.4 — https://erc-8004.quicknode.com/reputation-v1
- 8004scan — https://8004scan.io (leaderboard, agent Quality/Statistics tabs, score API `api/v1/agents/scores/v5/...`)
- 8004scan best practices, feedback data profile v2.0 — https://best-practices.8004scan.io/docs/02-feedback-standard.html
- 8004scan public API skill (jiayaoqijia/8004) — https://skills.lc/jiayaoqijia/8004/jiayaoqijia-8004-claude-skills-8004scan-skill-md
- 8004agents.ai — https://8004agents.ai
- TrustLayer Sybil Scanner skill — https://skills.cat/skills/bankrbot/skills/trustlayer-sybil-scanner
- Arbitrum Foundation sybil detection (funder/sweep graphs + Louvain) — https://github.com/ArbitrumFoundation/sybil-detection
- Trusta Labs, asset-transfer-graph Sybil framework — https://ethresear.ch/t/trusta-s-ai-and-machine-learning-framework-for-robust-sybil-resistance-in-airdrops/16828
- Hooi et al., BIRDNEST: Bayesian Inference for Ratings-Fraud Detection — https://arxiv.org/abs/1511.06030
- Kumar et al., FairJudge / REV2 (fairness–goodness–reliability) — https://arxiv.org/abs/1703.10545
- Beutel et al., CopyCatch (lockstep behavior), WWW 2013; Hooi et al., FRAUDAR (dense-subgraph fraud), KDD 2016
- Kamvar et al., EigenTrust, WWW 2003
- awesome-erc8004 (ecosystem list) — https://github.com/sudeepb02/awesome-erc8004
