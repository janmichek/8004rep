<script setup lang="ts">
import { computed } from 'vue'
import type { ChainInfo } from '../../chains'
import { computeFeedbackStats } from '../../data/feedbackStats'
import { buildReputationReport, type ReputationReport } from '../../data/reputation/report'
import { fetchScanScore } from '../../data/scan'
import { buildTrustReport } from '../../data/trustReport'
import type { AgentDetail, RegistrationFile } from '../../data/types'
import { formatDate, formatNumber, formatPercent } from '../../format'
import { useAsync } from '../../useAsync'
import StatTiles, { type Tile } from '../ui/StatTiles.vue'
import TabBar, { type Tab } from '../ui/TabBar.vue'
import CompareTab from './CompareTab.vue'
import FeedbackTab from './FeedbackTab.vue'
import MethodsTab from './MethodsTab.vue'
import OverviewTab from './OverviewTab.vue'
import ReviewersTab from './ReviewersTab.vue'

const props = defineProps<{ agent: AgentDetail; chain: ChainInfo; file?: RegistrationFile | null }>()

/** The agent's own addresses; feedback from them is flagged and weighs nothing. */
const self = computed(() => [props.agent.owner, props.agent.agentWallet].filter((a): a is NonNullable<typeof a> => a != null))
// Endpoint checks wait for the registration file; everything else shows at once.
const stats = computed(() =>
  computeFeedbackStats(props.agent.feedback, {
    owner: props.agent.owner,
    agentWallet: props.agent.agentWallet,
    ...(props.file ? { services: props.file.services.map((s) => s.endpoint) } : {}),
  }),
)
const report = computed(() => buildTrustReport(props.agent.feedback, stats.value, self.value))
const rep = computed(() => buildReputationReport(props.agent.feedback, { self: self.value }))

// 8004scan is a comparison, not a dependency: a failure only empties its tile.
const scan = useAsync(() => fetchScanScore(props.chain.chainId, props.agent.tokenId), () => [props.chain.chainId, props.agent.tokenId])

const CONFIDENCE_TONE: Record<ReputationReport['confidence'], Tile['tone']> = { low: 'warn', medium: undefined, high: 'good' }
const LEVEL: Record<string, { word: string; tone: Tile['tone'] }> = {
  high: { word: 'high risk', tone: 'bad' },
  warn: { word: 'needs a look', tone: 'warn' },
  info: { word: 'notes only', tone: undefined },
  clean: { word: 'no findings', tone: 'good' },
}

const tiles = computed<Tile[]>(() => {
  const r = rep.value
  const s = stats.value
  const onchain = props.agent.reputation
  const scanScore = scan.data.value
  const interval = r.interval ? `80% interval ${formatNumber(r.interval[0])}–${formatNumber(r.interval[1])}` : 'too few rating units for an interval'
  return [
    {
      label: 'Robust score',
      value: r.unrated ? 'Unrated' : formatNumber(r.score),
      hint: r.unrated ? 'no rating rows' : interval,
      title: r.unrated
        ? 'No review here is a rating. Telemetry, outcomes and quantities are listed, never averaged into a score.'
        : `One vote per wallet, ratings only, neutral prior of ${r.params.alpha0} wallets. ${r.confidence} confidence.`,
      tone: r.unrated ? 'quiet' : 'main',
      word: r.unrated,
    },
    {
      label: 'Confidence',
      value: r.confidence,
      hint: `${r.funnel.wallets} wallet${r.funnel.wallets === 1 ? '' : 's'} · ${r.funnel.units} unit${r.funnel.units === 1 ? '' : 's'}`,
      title: `${formatNumber(r.concentration.neff)} effective voices; the largest wallet holds ${formatPercent(r.concentration.top1)} of the weight.`,
      tone: CONFIDENCE_TONE[r.confidence],
      word: true,
    },
    {
      label: 'Risk',
      value: LEVEL[s.level].word,
      hint: s.signals.length ? `${s.signals.length} signal${s.signals.length === 1 ? '' : 's'}` : 'nothing flagged',
      title: 'Worst level among the signals on the Overview tab',
      tone: LEVEL[s.level].tone,
      word: true,
    },
    {
      label: 'Raw on-chain',
      value: formatNumber(onchain?.average ?? r.raw),
      hint: `n = ${onchain?.count ?? s.coverage.total}${r.inflation !== null && r.inflation > 0.5 ? ` · +${formatNumber(r.inflation)} vs robust` : ''}`,
      title: "Plain mean of non-revoked rows, as the registry's getSummary reports it. It mixes ratings with telemetry and quantities, so it is a baseline, not a quality score.",
    },
    {
      label: '8004scan',
      value: scanScore ? formatNumber(scanScore.total) : '—',
      hint: scan.error.value
        ? 'unreachable'
        : scanScore?.feedback
          ? `its feedback avg ${formatNumber(scanScore.feedback.average)}`
          : scan.loading.value
            ? ''
            : 'not scored there',
      title: "8004scan's overall score, read live from its public API — see the Compare tab",
      tone: 'quiet',
      loading: scan.loading.value,
    },
  ]
})

const headline = computed(() => {
  const r = rep.value
  if (r.unrated) {
    return r.counts.rating > 0
      ? `Unrated: ${r.counts.rating} rating row${r.counts.rating === 1 ? '' : 's'} sit outside every inferred scale. Telemetry and outcomes are listed separately.`
      : 'Unrated: no review here is a rating. Telemetry, outcomes and quantities are listed, never averaged into a score.'
  }
  const gap = r.inflation
  const versus = gap === null || Math.abs(gap) < 0.5 ? 'the raw rating mean' : `the raw rating mean ${formatNumber(r.rawRatings)} (${gap > 0 ? '+' : ''}${formatNumber(gap)} of inflation removed)`
  return `Robust score ${formatNumber(r.score)} (${r.confidence} confidence) on ${r.funnel.wallets} wallet${r.funnel.wallets === 1 ? '' : 's'}, ${versus}.`
})

const rowsRead = computed(() => {
  const total = props.agent.totalFeedback
  if (!total || total <= props.agent.feedback.length) return ''
  return `Computed on ${props.agent.feedback.length.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} reviews (source cap).`
})

const flagged = computed(() => stats.value.rows.filter((r) => !r.flags.includes('revoked') && r.weight < 1).length)
const tabs = computed<Tab[]>(() => [
  { id: 'overview', label: 'Overview' },
  { id: 'feedback', label: 'Feedback', count: props.agent.feedback.length },
  {
    id: 'reviewers',
    label: 'Reviewers',
    count: stats.value.reviewers.length,
    ...(stats.value.signals.some((s) => s.code === 'concentration' || s.code === 'self') ? { tone: 'warn' as const } : {}),
  },
  { id: 'methods', label: 'Methods' },
  { id: 'compare', label: 'vs 8004scan' },
])
</script>

<template>
  <section class="reputation" aria-labelledby="reputation-title">
    <h2 id="reputation-title">
      Reputation
      <small v-if="agent.feedbackSince">feedback dated back to {{ formatDate(agent.feedbackSince) }} (log scan window)</small>
    </h2>

    <template v-if="agent.feedback.length === 0">
      <p class="muted">No feedback yet. Nothing to score.</p>
    </template>
    <template v-else>
      <StatTiles :tiles="tiles" />
      <p class="headline">
        {{ headline }}
        <span v-if="flagged" class="muted">{{ flagged }} of {{ agent.feedback.length }} rows count less than a full vote.</span>
        <span v-if="rowsRead" class="muted">{{ rowsRead }}</span>
      </p>

      <TabBar :tabs="tabs" label="Reputation views">
        <template #overview>
          <OverviewTab :feedback="agent.feedback" :stats="stats" :report="report" :rep="rep" />
        </template>
        <template #feedback>
          <FeedbackTab :agent="agent" :chain="chain" :stats="stats" />
        </template>
        <template #reviewers>
          <ReviewersTab :agent="agent" :chain="chain" :stats="stats" :self="self" />
        </template>
        <template #methods>
          <MethodsTab :rep="rep" :feedback="agent.feedback" />
        </template>
        <template #compare>
          <CompareTab
            :chain="chain"
            :token-id="agent.tokenId"
            :feedback="agent.feedback"
            :raw="report.raw"
            :trusted="rep.score"
            :scan="scan.data.value"
            :loading="scan.loading.value"
            :error="scan.error.value"
          />
        </template>
      </TabBar>
    </template>
  </section>
</template>
