<script setup lang="ts">
import { computed } from 'vue'
import type { ChainInfo } from '../../chains'
import { computeFeedbackStats } from '../../data/feedbackStats'
import { fetchScanScore, fetchScanStats } from '../../data/scan'
import { buildTrustReport, type StrengthTier } from '../../data/trustReport'
import type { AgentDetail, RegistrationFile } from '../../data/types'
import { formatDate, formatNumber } from '../../format'
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

// 8004scan is a comparison, not a dependency: a failure only empties its tile.
const scan = useAsync(() => fetchScanScore(props.chain.chainId, props.agent.tokenId), () => [props.chain.chainId, props.agent.tokenId])
const ecosystem = useAsync(() => fetchScanStats(), () => true)

const TIER_TONE: Record<StrengthTier, Tile['tone']> = { none: 'quiet', thin: 'warn', moderate: undefined, strong: 'good' }
const LEVEL: Record<string, { word: string; tone: Tile['tone'] }> = {
  high: { word: 'high risk', tone: 'bad' },
  warn: { word: 'needs a look', tone: 'warn' },
  info: { word: 'notes only', tone: undefined },
  clean: { word: 'no findings', tone: 'good' },
}

const tiles = computed<Tile[]>(() => {
  const r = report.value
  const s = stats.value
  const onchain = props.agent.reputation
  const scanScore = scan.data.value
  return [
    {
      label: 'Trusted score',
      value: formatNumber(r.trusted),
      hint: r.lcb === null ? 'too few votes for a bound' : `95% bound ${formatNumber(r.lcb)}`,
      title: 'Weighted average after every rule in “How the score is built” (Overview tab)',
      tone: 'main',
    },
    {
      label: 'Evidence',
      value: r.strength.tier,
      hint: `${s.reviewers.length} reviewer${s.reviewers.length === 1 ? '' : 's'}`,
      title: r.strength.reasons.join('\n'),
      tone: TIER_TONE[r.strength.tier],
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
      hint: `n = ${onchain?.count ?? s.coverage.total}`,
      title: "Plain mean of non-revoked rows, as the registry's getSummary reports it",
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
    {
      label: 'Ecosystem avg',
      value: ecosystem.data.value ? formatNumber(ecosystem.data.value.averageFeedback) : '—',
      hint: ecosystem.data.value
        ? `${ecosystem.data.value.totalFeedback.toLocaleString('en-US')} reviews`
        : ecosystem.loading.value
          ? ''
          : 'unreachable',
      title: 'Mean feedback value over every agent 8004scan indexes: what a typical rating looks like',
      tone: 'quiet',
      loading: ecosystem.loading.value,
    },
  ]
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
        {{ report.headline }}
        <span v-if="flagged" class="muted">{{ flagged }} of {{ agent.feedback.length }} rows count less than a full vote.</span>
      </p>

      <TabBar :tabs="tabs" label="Reputation views">
        <template #overview>
          <OverviewTab
            :feedback="agent.feedback"
            :stats="stats"
            :report="report"
            :ecosystem-average="ecosystem.data.value?.averageFeedback"
          />
        </template>
        <template #feedback>
          <FeedbackTab :agent="agent" :chain="chain" :stats="stats" />
        </template>
        <template #reviewers>
          <ReviewersTab :agent="agent" :chain="chain" :stats="stats" :self="self" />
        </template>
        <template #methods>
          <MethodsTab :feedback="agent.feedback" :self="self" />
        </template>
        <template #compare>
          <CompareTab
            :chain="chain"
            :token-id="agent.tokenId"
            :feedback="agent.feedback"
            :raw="report.raw"
            :trusted="report.trusted"
            :scan="scan.data.value"
            :loading="scan.loading.value"
            :error="scan.error.value"
          />
        </template>
      </TabBar>
    </template>
  </section>
</template>
