# rep-1.0 — published ERC-8004 reputation specification

`rep-1.0` is the reputation formula 8004rep runs in the browser and in its indexer. The same
implementation lives in [`shared/reputation/`](../shared/reputation/) and is published at
`GET /api/reputation/spec`. This document is the human-readable contract; the code is the
executable one.

## Inputs

The formula reads ERC-8004 `NewFeedback`, `FeedbackRevoked` and `ResponseAppended` events for one
agent on one chain:

| Input        | Source                                | Used for                                               |
| ------------ | ------------------------------------- | ------------------------------------------------------ |
| `value`      | `NewFeedback.value` + `valueDecimals` | The observed number.                                   |
| `tag1`       | `NewFeedback.tag1`                    | Kind and rating scale.                                 |
| `client`     | `NewFeedback.clientAddress`           | One wallet = one vote.                                 |
| `createdAt`  | Block timestamp                       | 30-day unit windows and 90-day decay.                  |
| `revoked`    | `FeedbackRevoked`                     | Revoked rows never enter the score.                    |
| `responses`  | `ResponseAppended`                    | Responsiveness only; they never change the score.      |
| self address | `owner` and `agentWallet` metadata    | Rows from these addresses are listed but never scored. |

Everything is keyed by `(chainId, tokenId)`. Token ids repeat between chains.

## 1. Drop revoked and self rows

- A revoked row is counted in `counts.revoked` and excluded from the score.
- A row whose client equals the current owner or the `agentWallet` metadata address is counted in
  `counts.self` and excluded from the score.
- Neither may redefine a tag scale: scales are inferred after these rows are removed.

## 2. Classify by tag

`tagKey(tag1)` folds case, separators and camel/snake spelling. The curated table maps it to one of:

| Kind        | Meaning                                           | Scored? |
| ----------- | ------------------------------------------------- | ------- |
| `rating`    | A judgement of quality (starred, quality, trust…) | yes     |
| `outcome`   | Whether something happened (pass, paid, dispute…) | no      |
| `telemetry` | A measurement of the service (uptime, latency…)   | no      |
| `metric`    | A quantity (revenue, volume, ELO…)                | no      |
| `unknown`   | A tag the specification has no meaning for        | no      |

Namespaced tags are matched whole, then by their last segment, then by their first segment.

## 3. Chain-wide tag scales

For every tag, the scale is inferred over every non-revoked, non-self row on the chain:

- `{0, 1}` with both values present → `binary`, span 1.
- A repeated value → the narrowest non-binary scale (`five`, `ten`, `hundred`); repeated `1` is
  20/100, not a perfect score.
- More than 20% negative values → `signed`; the 80th percentile of absolute values picks ±1, ±5,
  ±10 or ±100.
- Otherwise the narrowest of 0–1, 0–5, 0–10, 0–100 that holds at least 80% of the values.
- Values that fit no scale are `outOfScale` and never enter a unit.

The indexer stores chain-wide scales in `tag_scales`. The client falls back to inferring from the
agent’s own rows when the chain has not been indexed; both paths run the same code.

## 4. Normalise ratings

For a rating row with scale span `s`:

- `binary` / `unit`: `value` when `0 ≤ value ≤ 1`.
- `five` / `ten` / `hundred`: `value / s` when `0 ≤ value ≤ s`.
- `signed`: `(value + s) / (2s)` when `|value| ≤ s`.

## 5. Collapse to units

A rating unit is one `(wallet, tag, 30-day window)`. Repeats in the window collapse to their median;
volume is not a voice. A unit’s timestamp is the median row time, so row order does not matter.

## 6. Time decay and wallet cap

Each unit’s weight is `2^(-ageDays / 90)` measured against the scoring clock. A wallet’s weight is
`min(1, Σ unit weights)`: one wallet cannot hold more than one full vote, however many repeats it
writes. A wallet’s rating is the median of its unit ratings.

## 7. Beta posterior

With prior strength `α₀ = 3` and neutral mean `μ₀ = 0.5`:

```text
A = α₀·μ₀ + Σ (walletWeight · walletRating)
B = α₀·(1−μ₀) + Σ (walletWeight · (1−walletRating))
score = A / (A + B)                # 0–1, reported ×100
```

The 80% credible interval is the 10th–90th percentile of `Beta(A, B)` (bisection on the regularised
incomplete beta). Unrated means no rating units: `score`, interval and cost are `null`.

## 8. Confidence

| Label  | Rule                                                                                |
| ------ | ----------------------------------------------------------------------------------- |
| `low`  | no units, total weight < 3, or fewer than 3 wallets                                 |
| `high` | total weight ≥ 10 **and** effective wallets ≥ 5 **and** largest-wallet share < 0.30 |
| medium | everything else                                                                     |

Effective wallets is `1 / Σ share²` (inverse HHI). The largest-wallet share is measured on the
capped wallet weights.

## 9. Cost to fake

With target `t = 0.9`:

```text
cost = ceil((α₀ + totalWeight) · (t − score) / (1 − t))   when score < t
cost = null                                               otherwise
```

It prices the fresh, unlinked wallet weight needed to reach the target, ignoring the cost of
funding those wallets.

## 10. Findings and responsiveness

The report lists warning patterns computed from the same rows: repeat volume, a locked extreme
template, same-transaction rows, a one-day burst, a review bomb, and revocations. Findings never
change the score. Responsiveness reports how many low ratings received a response and the median
days to the first reply; self and third-party replies are counted separately.

## 11. Canonical inputs and `contentHash`

`GET /api/agents/{chainId}/{tokenId}/reputation` returns a SHA-256 `contentHash` over canonical
JSON: keys sorted at every level, no whitespace, with the agent id, formula version, feedback rows,
responses and tag scales included and no derived score. A verifier can rebuild the hash from the
same inputs without trusting this service.

## 12. Determinism

`buildReputationReport` is pure: the same rows, scales and `now` produce the same bytes. The indexer
scores with `now = scoring time`, the browser scores with its clock; both use the same code and the
same parameters, so a materialized score and a client recomputation agree up to the clock.

## Differences from 8004scan

8004scan publishes an opaque 0–100 leaderboard score with engagement, service, publisher,
compliance and momentum dimensions. `rep-1.0` is deliberately narrower:

- Only rating-kind rows enter the score; telemetry, outcomes, metrics and unknown tags do not.
- A wallet can hold at most one vote regardless of review volume.
- Self-reviews are excluded rather than down-weighted.
- New or thin evidence is pulled toward the neutral prior instead of the extremes.
- The formula, parameters, waterfall, interval, findings and canonical inputs are published and
  downloadable.

8004scan remains on the agent page only as a live comparison tile and the “vs 8004scan” tab.
