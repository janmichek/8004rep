<script setup lang="ts">
import { BookOpen, Gauge, GitCompareArrows, IdCard, MessageSquare, Users } from '@lucide/vue'
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
const CONFIDENCE_STEPS: Record<ReputationReport['confidence'], number> = { low: 1, medium: 2, high: 3 }
const LEVEL: Record<string, { word: string; tone: Tile['tone']; severity: number }> = {
  high: { word: 'high risk', tone: 'bad', severity: 3 },
  warn: { word: 'needs a look', tone: 'warn', severity: 2 },
  info: { word: 'notes only', tone: undefined, severity: 1 },
  clean: { word: 'no findings', tone: 'good', severity: 0 },
}

const tiles = computed<Tile[]>(() => {
  const r = rep.value
  const s = stats.value
  const onchain = props.agent.reputation
  const scanScore = scan.data.value
  const rawValue = onchain?.average ?? r.raw
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
      meter: r.unrated ? undefined : { kind: 'gauge', value: r.score, band: r.interval },
    },
    {
      label: 'Confidence',
      value: r.confidence,
      hint: `${r.funnel.wallets} wallet${r.funnel.wallets === 1 ? '' : 's'} · ${r.funnel.units} unit${r.funnel.units === 1 ? '' : 's'}`,
      title: `${formatNumber(r.concentration.neff)} effective voices; the largest wallet holds ${formatPercent(r.concentration.top1)} of the weight.`,
      tone: CONFIDENCE_TONE[r.confidence],
      word: true,
      meter: { kind: 'steps', filled: CONFIDENCE_STEPS[r.confidence], total: 3 },
    },
    {
      label: 'Risk',
      value: LEVEL[s.level].word,
      hint: s.signals.length ? `${s.signals.length} signal${s.signals.length === 1 ? '' : 's'}` : 'nothing flagged',
      title: 'Worst level among the signals on the Overview tab',
      tone: LEVEL[s.level].tone,
      word: true,
      meter: { kind: 'severity', level: LEVEL[s.level].severity, max: 3 },
    },
    {
      label: 'Raw on-chain',
      value: formatNumber(rawValue),
      hint: `n = ${onchain?.count ?? s.coverage.total}${r.inflation !== null && r.inflation > 0.5 ? ` · +${formatNumber(r.inflation)} vs robust` : ''}`,
      title: "Plain mean of non-revoked rows, as the registry's getSummary reports it. It mixes ratings with telemetry and quantities, so it is a baseline, not a quality score.",
      meter: rawValue === null || rawValue === undefined ? undefined : { kind: 'gauge', value: rawValue },
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
      title: "8004scan's overall score, read live from its public API — see the vs 8004scan tab",
      tone: 'quiet',
      loading: scan.loading.value,
      meter: scanScore ? { kind: 'gauge', value: scanScore.total } : undefined,
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
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare, count: props.agent.feedback.length },
  {
    id: 'reviewers',
    label: 'Reviewers',
    icon: Users,
    count: stats.value.reviewers.length,
    ...(stats.value.signals.some((s) => s.code === 'concentration' || s.code === 'self') ? { tone: 'warn' as const } : {}),
  },
  { id: 'identity', label: 'Identity', icon: IdCard },
  { id: 'methods', label: 'Methods', icon: BookOpen },
  { id: 'compare', label: 'vs 8004scan', icon: GitCompareArrows },
])
</script>

<template>
  <TabBar :tabs="tabs" label="Agent views">
    <template #overview>
      <slot name="overview-top" />

      <template v-if="agent.feedback.length === 0">
        <p class="muted">No feedback yet. Nothing to score.</p>
      </template>
      <template v-else>
        <p v-if="agent.feedbackSince" class="muted note">
          Feedback dated back to {{ formatDate(agent.feedbackSince) }} (log scan window).
        </p>
        <StatTiles :tiles="tiles" />
        <p class="headline">
          {{ headline }}
          <span v-if="flagged" class="muted">{{ flagged }} of {{ agent.feedback.length }} rows count less than a full vote.</span>
          <span v-if="rowsRead" class="muted">{{ rowsRead }}</span>
        </p>

        <OverviewTab :feedback="agent.feedback" :stats="stats" :report="report" :rep="rep" />
      </template>
    </template>

    <template #feedback>
      <p v-if="agent.feedback.length === 0" class="muted">No feedback yet.</p>
      <FeedbackTab v-else :agent="agent" :chain="chain" :stats="stats" />
    </template>

    <template #reviewers>
      <p v-if="agent.feedback.length === 0" class="muted">No reviewers yet.</p>
      <ReviewersTab v-else :agent="agent" :chain="chain" :stats="stats" :self="self" />
    </template>

    <template #identity>
      <slot name="identity" />
    </template>

    <template #methods>
      <p v-if="agent.feedback.length === 0" class="muted">No feedback yet. Nothing to score.</p>
      <MethodsTab v-else :rep="rep" :feedback="agent.feedback" />
    </template>

    <template #compare>
      <p v-if="agent.feedback.length === 0" class="muted">No feedback yet. Nothing to compare.</p>
      <CompareTab
        v-else
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
