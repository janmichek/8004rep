/**
 * The vocabulary of the explorer. Every entry has a stable `id` so a number in
 * the app can link back to the paragraph that defines it:
 *   { name: 'about', hash: `#${id}` }
 * Keep ids stable; they are part of the page's addresses.
 */

export type GuideMetric = {
  /** Stable anchor id. Never rename without keeping the old one as an alias. */
  id: string
  name: string
  /** One sentence a reader can stop at. */
  summary: string
  /** The exact rule, threshold or formula when there is one. */
  rule?: string
  /** The number, chip or panel in the app that uses it. */
  where?: string
  /** The honest limit of the metric. */
  caveat?: string
}

export type GuideGroup = {
  id: string
  title: string
  intro: string
  metrics: GuideMetric[]
}

export const METRIC_GROUPS: GuideGroup[] = [
  {
    id: 'reading',
    title: 'Reading feedback',
    intro:
      'ERC-8004 stores a bare integer for every feedback row. The same registry carries star ratings, uptime percentages, pass flags and revenue figures. Everything starts by deciding what a value means.',
    metrics: [
      {
        id: 'feedback-row',
        name: 'Feedback row',
        summary: 'One review written to an agent’s reputation registry: a client address, an integer value, optional tags, an optional endpoint and date.',
        rule: 'Rows are read from the registry over RPC or from the agent0 subgraph. The author can revoke a row later; the revocation is kept and shown.',
        where: 'Feedback tab, and the rows behind every score.',
      },
      {
        id: 'rating-only',
        name: 'Ratings only',
        summary: 'Only rows that express a judgement of quality enter the score. Outcomes, telemetry and quantities are displayed but never averaged into it.',
        rule: 'Kinds: rating (starred, quality, trust, review…) is scored. outcome (pass, paid, dispute…), telemetry (uptime, latency, success rate…) and metric (revenue, volume, win rate…) are listed only.',
        where: '“What counts” on the Methods tab; the rating/outcome/telemetry tiles on the Overview tab.',
        caveat: 'A tag this explorer does not recognise is treated as “other” and is never scored.',
      },
      {
        id: 'scale',
        name: 'Inferred rating scale',
        summary: 'A rating is read on the scale its tag actually uses, then normalised to 0–100. Five stars is not five out of one hundred.',
        rule: 'The scale is inferred from the observed values: 0/1 (binary), 0–1, 0–5, 0–10 or 0–100, or a signed ±1/±5/±10/±100 span. A reviewer with three or more values on a tag can set its own scale. Values outside the inferred scale are listed but not scored.',
        where: 'Rating values chart on the Overview tab; “off-scale” counts in the Methods tab.',
      },
      {
        id: 'rating-unit',
        name: 'Rating unit',
        summary: 'One reviewer’s ratings of one tag in one 30-day window collapse to a single value, so repetition inside a month cannot multiply a voice.',
        rule: 'Unit value = median of the row ratings in the unit. Unit window = 30 days. Rows without a date form an “undated” unit.',
        where: '“From rows to voices” on the Methods tab; the downloadable inputs JSON.',
      },
      {
        id: 'half-life',
        name: 'Time decay',
        summary: 'Older units count less. A unit’s weight halves every 90 days.',
        rule: 'time = 2^(−ageDays / 90), where age is measured from the newest dated row in the agent’s set.',
        where: 'Methods tab parameters; wallet weights in the inputs JSON.',
      },
      {
        id: 'wallet-vote',
        name: 'One wallet, one vote',
        summary: 'A wallet’s weight is the sum of its unit weights, capped at 1. No wallet can ever hold more than one full vote.',
        rule: 'wallet weight = min(1, Σ unit.time). Wallet value = median of its unit values. Self-reviews and revoked rows are excluded before this step.',
        where: 'Reviewers tab; “wallets carrying weight” in the funnel.',
      },
    ],
  },
  {
    id: 'score',
    title: 'The robust score',
    intro:
      'The headline number is a Bayesian average of one vote per independent wallet, with a neutral prior. It is deliberately conservative when evidence is thin.',
    metrics: [
      {
        id: 'robust-score',
        name: 'Robust score',
        summary: 'A 0–100 quality score built from rating rows only, with each independent wallet contributing at most one vote.',
        rule: 'score = (α₀·μ₀ + Σ W_c·r̄_c) / (α₀ + Σ W_c), scaled to 0–100. W_c is the capped wallet weight and r̄_c the wallet’s median rating.',
        where: 'First tile of the Reputation panel; “Robust score” on the Methods tab.',
      },
      {
        id: 'prior',
        name: 'Neutral prior',
        summary: 'The score starts as if three unverified wallets had each rated 50/100, so a handful of reviews cannot claim certainty.',
        rule: 'α₀ = 3 wallets at μ₀ = 0.5 (50/100). Its pull fades as real weight accumulates.',
        where: 'Methods tab parameters; “largest influence” uses the prior too.',
      },
      {
        id: 'interval',
        name: '80% interval',
        summary: 'The plausible range of the score given the evidence, from a Beta posterior.',
        rule: 'Beta(α, β) with α = α₀·μ₀ + Σ W_c·r̄_c and β = α₀·(1−μ₀) + Σ W_c·(1−r̄_c); the interval runs from the 10th to the 90th percentile.',
        where: 'Second line of the Robust score tile and the Methods tab.',
      },
      {
        id: 'confidence',
        name: 'Confidence',
        summary: 'How much evidence stands behind the score: low, medium or high.',
        rule: 'low = under 3 full votes or under 3 wallets. high = 10+ full votes, 5+ effective voices and no wallet holding 30% of the weight. medium = everything in between.',
        where: 'Confidence tile; the word next to the score.',
        caveat: 'Confidence measures quantity and concentration, not honesty. Ten colluding wallets can produce “high”.',
      },
      {
        id: 'unrated',
        name: 'Unrated',
        summary: 'No rating rows fit any scale. Telemetry and outcomes are shown, but no score is invented.',
        rule: 'Shown when the agent has zero rating units. Reasons may include out-of-scale values or only non-rating tags.',
        where: 'Robust score tile, Methods tab and the reputation headline.',
      },
    ],
  },
  {
    id: 'resistance',
    title: 'Concentration and resistance to faking',
    intro:
      'A score is only as good as the independence of the wallets behind it. These metrics show how concentrated the weight is and what it would cost to move the number.',
    metrics: [
      {
        id: 'effective-voices',
        name: 'Effective voices',
        summary: 'How many equally weighted wallets the result is worth, regardless of how many wallets exist.',
        rule: '1 / HHI over wallet weights, where HHI = Σ (weight_c / Σ weights)². 1 means one wallet holds everything.',
        where: 'Methods tab; Confidence tile tooltip; network suspect list.',
      },
      {
        id: 'top-shares',
        name: 'Top wallet / top three',
        summary: 'The share of total weight held by the largest wallet and by the three largest.',
        rule: 'Computed after the per-wallet cap. A high top share means the score is one voice’s opinion.',
        where: 'Methods tab shape metrics.',
      },
      {
        id: 'max-influence',
        name: 'Largest influence',
        summary: 'The biggest single-wallet share of the prior plus all weights.',
        rule: 'max(weight_c) / (α₀ + Σ weights). With no reviews the prior alone is 50%; a single full vote moves it to 1/4 = 25%.',
        where: 'Methods tab shape metrics.',
      },
      {
        id: 'inflation',
        name: 'Inflation gap',
        summary: 'The raw rating mean minus the robust score. A large positive gap means the rules removed weight the raw average counts in full.',
        rule: 'inflation = rawRatings − robust score. Only rating rows enter rawRatings, so this is not the same as the registry’s all-row average.',
        where: 'Methods tab alternative tiles; “vs robust” in the Raw on-chain tile.',
      },
      {
        id: 'cost-to-fake',
        name: 'Cost to fake',
        summary: 'How many fresh, unlinked wallets would be needed to force the score to 90/100, assuming none can be connected to each other.',
        rule: 'ceil(((α₀ + Σ W) · (0.9 − score)) / (1 − 0.9)). Each wallet also costs its feedback fee and a funding path.',
        where: 'Methods tab alternative tiles.',
        caveat: 'This is a lower bound on effort, not a prediction. Wallets that share a funder are exposed on the Reviewers tab.',
      },
    ],
  },
  {
    id: 'row-rules',
    title: 'Rules applied to a review',
    intro:
      'Each rule lowers a row’s weight or removes it. A row’s weight is its share of a full vote; the Feedback tab shows the flags that produced it.',
    metrics: [
      { id: 'revoked', name: 'Revoked', summary: 'The author withdrew the review. It counts nowhere.', where: 'Everywhere; a revoked row stays visible in the feedback log.' },
      {
        id: 'self-review',
        name: 'Self-review',
        summary: 'The client is the agent owner or the agent wallet. Weight 0.',
        where: 'Self signal; Feedback tab.',
      },
      {
        id: 'duplicate',
        name: 'Duplicate',
        summary: 'The same client repeats an earlier (value, tag1, tag2, endpoint) combination. Weight 0.',
        where: 'Feedback tab weight column.',
      },
      {
        id: 'burst',
        name: 'Burst',
        summary: 'More than two reviews from one client inside 24 hours. Weight is reduced exponentially.',
        rule: 'weight × exp(−(N−2)), where N is the number of rows in the 24-hour window.',
        where: 'Feedback tab; “Discount bursts” in the score waterfall.',
      },
      {
        id: 'monotonous',
        name: 'Monotonous',
        summary: 'A client left three or more reviews and every one has the same value. Weight × 0.4.',
        where: 'Feedback tab; reviewer “rubber stamp” label.',
      },
      {
        id: 'hyperactive',
        name: 'Hyperactive',
        summary: 'A client left more than five reviews on this agent. Weight × 0.7.',
        where: 'Feedback tab.',
      },
      {
        id: 'outlier',
        name: 'Outlier',
        summary: 'A value far from the agent’s median. The row is flagged but its weight is not changed by this rule.',
        rule: 'Robust z = (value − median) / (1.4826 · MAD), flagged beyond ±3.5.',
        where: 'Feedback tab; “values far from the median” signal.',
      },
      {
        id: 'off-scale',
        name: 'Off-scale',
        summary: 'A rating value outside the scale inferred for its tag. It is listed but not scored.',
        where: 'Feedback tab; “off-scale” signal; Methods tab.',
      },
      {
        id: 'unlisted-endpoint',
        name: 'Unlisted endpoint',
        summary: 'The row names a service endpoint that the agent’s registration file does not advertise. It stays visible as a warning.',
        where: 'Feedback tab; coverage row; signal.',
      },
    ],
  },
  {
    id: 'reviewer-labels',
    title: 'Reviewer labels',
    intro:
      'These describe habits across all of a reviewer’s reviews, not one row. They are computed from the reviewer’s full feedback history.',
    metrics: [
      {
        id: 'rubber-stamp',
        name: 'Rubber stamp',
        summary: 'Five or more reviews and at least 90% of them carry the same value.',
        where: 'Reviewers tab; network suspects.',
      },
      { id: 'single-agent', name: 'One agent only', summary: 'Three or more reviews, all on the same agent.', where: 'Reviewers tab.' },
      { id: 'bulk-writer', name: 'Bulk writer', summary: 'Ten or more reviews inside one 24-hour window.', where: 'Reviewers tab; network suspects.' },
      { id: 'mass-reviewer', name: 'Mass reviewer', summary: 'Rated ten or more different agents.', where: 'Reviewers tab; network suspects.' },
      { id: 'harsh', name: 'Harsh', summary: 'Five or more reviews averaging 30 or less.', where: 'Reviewers tab; network suspects.' },
    ],
  },
  {
    id: 'signals',
    title: 'Signals, evidence and comparison',
    intro:
      'Beyond the score, the explorer shows the checks a human would make: who paid, what was rated, whether the agent answers, and what another indexer reports.',
    metrics: [
      {
        id: 'risk-level',
        name: 'Risk level',
        summary: 'The worst level among the signals on the Overview tab: high, warn, info or clean.',
        rule: 'Signals include self-reviews, one wallet holding half or more of the reviews, a single reviewer swinging the mean, heavy discounts, surges, revocations, a recent decline, off-scale values, outliers, unlisted endpoints and undated rows.',
        where: 'Risk tile; Overview “What stands out”.',
      },
      {
        id: 'coverage',
        name: 'Coverage',
        summary: 'How many reviews carry a date, a transaction, a feedback file and an endpoint.',
        where: 'Evidence panel on the Overview tab.',
        caveat: 'Coverage is about verifiability, not quality. A review can be fully documented and still be paid for.',
      },
      {
        id: 'evidence-ladder',
        name: 'Evidence ladder',
        summary: 'Each non-revoked review is grouped by the strongest evidence it carries.',
        rule: 'Feedback file (a URI to a comment, task or payment proof) > says what was rated (a tag or endpoint) > bare value.',
        where: 'Evidence panel on the Overview tab.',
      },
      {
        id: 'responsiveness',
        name: 'Responsiveness',
        summary: 'How often a low rating gets an answer, how fast, and from whom.',
        rule: 'Low ratings are ratings at or below half of their scale. Responses from the owner or agent wallet are counted separately from third-party replies; median lag is in days.',
        where: 'Methods tab.',
      },
      {
        id: 'telemetry',
        name: 'Telemetry',
        summary: 'Non-rating measurements such as uptime, latency or success rate: is the service up, not is it good.',
        rule: 'Grouped by tag with row count, wallet count, latest value and median. Never averaged into the score.',
        where: 'Overview tab telemetry table.',
      },
      {
        id: 'raw-onchain',
        name: 'Raw on-chain average',
        summary: 'The plain mean the registry reports, mixing every kind of feedback row.',
        rule: 'Mean of non-revoked values, as `getSummary` returns it. Useful as a baseline; not a quality score.',
        where: 'Raw on-chain tile; waterfall “Every review” step.',
        caveat: 'A single 0–5 star rating and an uptime of 99 pull the same average in different directions.',
      },
      {
        id: '8004scan',
        name: '8004scan score',
        summary: 'A second opinion read live from 8004scan’s public API.',
        rule: 'The overall score and its feedback average, side by side with this explorer’s numbers.',
        where: '8004scan tile; “vs 8004scan” tab.',
        caveat: '8004scan is a comparison, not a dependency. If its API is unreachable the tile empties and nothing else changes.',
      },
    ],
  },
  {
    id: 'network',
    title: 'Network health',
    intro:
      'The network page works on one window of a chain’s feedback feed. It finds the habits that are invisible on a single agent’s page.',
    metrics: [
      {
        id: 'network-average',
        name: 'Network average',
        summary: 'The mean of normalised rating rows only, 0–100, with no weighting.',
        where: 'Network health header.',
        caveat: 'It is a description of the feed, not a ranking. One agent with many reviews moves it more than many small agents.',
      },
      {
        id: 'perfect-share',
        name: 'Perfect share',
        summary: 'The share of rating rows at 99 or above after normalisation.',
        where: 'Network health header.',
        caveat: 'A high perfect share can be genuine enthusiasm or a sign of coordinated reviews; the suspect list is the follow-up.',
      },
      {
        id: 'suspects',
        name: 'Suspect reviewers',
        summary: 'Reviewers carrying at least one reviewer label, ranked by how many warnings they collect.',
        rule: 'Suspicion score: warning labels count 2, informational labels count 1. Only labelled reviewers appear.',
        where: 'Network health suspect table.',
      },
      {
        id: 'lookalikes',
        name: 'Lookalike agents',
        summary: 'Groups of agents whose reviewer sets nearly coincide.',
        rule: 'Two agents are linked when their reviewer sets have a Jaccard similarity of 0.8 or more and share at least two reviewers; groups are the connected components.',
        where: 'Network health lookalikes panel.',
        caveat: 'A shared reviewer is not proof of collusion. Popular agents can legitimately share reviewers.',
      },
    ],
  },
]

/** Flat lookup for future links from a metric name to its anchor. */
export const METRICS_BY_ID = new Map(METRIC_GROUPS.flatMap((group) => group.metrics.map((metric) => [metric.id, { ...metric, group }])))
