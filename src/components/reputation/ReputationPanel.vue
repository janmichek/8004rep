<script setup lang="ts">
import { computed } from 'vue'
import { txExplorerUrl, type ChainInfo } from '../../chains'
import { computeFeedbackStats } from '../../data/feedbackStats'
import { fetchScanScore, fetchScanStats } from '../../data/scan'
import { buildTrustReport, type StrengthTier } from '../../data/trustReport'
import type { AgentDetail, RegistrationFile } from '../../data/types'
import { formatDate, formatNumber, formatScore, formatTimeline, shortAddress } from '../../format'
import { useAsync } from '../../useAsync'
import FeedbackNote from '../FeedbackNote.vue'
import StatTiles, { type Tile } from '../ui/StatTiles.vue'

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
      tone: 'main',
    },
    {
      label: 'Evidence',
      value: r.strength.tier,
      hint: `${s.reviewers.length} reviewer${s.reviewers.length === 1 ? '' : 's'}`,
      tone: TIER_TONE[r.strength.tier],
      word: true,
    },
    {
      label: 'Risk',
      value: LEVEL[s.level].word,
      hint: s.signals.length ? `${s.signals.length} signal${s.signals.length === 1 ? '' : 's'}` : 'nothing flagged',
      tone: LEVEL[s.level].tone,
      word: true,
    },
    {
      label: 'Raw on-chain',
      value: formatNumber(onchain?.average ?? r.raw),
      hint: `n = ${onchain?.count ?? s.coverage.total}`,
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
      tone: 'quiet',
      loading: ecosystem.loading.value,
    },
  ]
})
</script>

<template>
  <section class="reputation" aria-labelledby="reputation-title">
    <h2 id="reputation-title">
      Reputation
      <small v-if="agent.feedbackSince">feedback dated back to {{ formatDate(agent.feedbackSince) }} (log scan window)</small>
    </h2>

    <p v-if="agent.feedback.length === 0" class="muted">No feedback yet. Nothing to score.</p>
    <template v-else>
      <StatTiles :tiles="tiles" />

      <section class="panel">
        <h3>Feedback <small>{{ agent.feedback.length }}</small></h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Reviewer</th><th class="num">Value</th><th>Text</th><th>When</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in agent.feedback" :key="`${row.client}:${row.index ?? i}`" :class="{ revoked: row.revoked }">
                <td class="nowrap">
                  <RouterLink
                    :to="{ name: 'reviewer', params: { slug: chain.slug, address: row.client } }"
                    class="mono"
                    :title="row.client"
                  >
                    {{ shortAddress(row.client) }}
                  </RouterLink>
                </td>
                <td class="num">
                  <b>{{ formatScore(row.value) }}</b>
                  <span v-if="row.revoked" class="chip">revoked</span>
                </td>
                <td class="text-cell">
                  <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                  <span v-else class="muted">—</span>
                </td>
                <td class="nowrap">
                  <template v-if="row.createdAt">
                    <a v-if="row.txHash" :href="txExplorerUrl(chain, row.txHash)" target="_blank" rel="noopener noreferrer" :title="formatDate(row.createdAt)">
                      {{ formatTimeline(row.createdAt) }}
                    </a>
                    <span v-else :title="formatDate(row.createdAt)">{{ formatTimeline(row.createdAt) }}</span>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
