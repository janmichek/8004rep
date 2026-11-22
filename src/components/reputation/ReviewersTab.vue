<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Address } from 'viem'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../../chains'
import ChainName from '../ChainName.vue'
import { sourceFor } from '../../data'
import { FLAG_INFO, type FeedbackStats } from '../../data/feedbackStats'
import { clusterByFunder } from '../../data/funding'
import type { ReputationReport } from '../../data/reputation/report'
import { loadReviewerInsights, type ReviewerInsight } from '../../data/reviewerInsights'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import type { AgentDetail } from '../../data/types'
import { formatDate, formatNumber, formatPercent, formatSigned, shortAddress } from '../../format'
import { useRowLink } from '../../useRowLink'
import { useSort } from '../../useSort'
import AddressIdenticon from '../AddressIdenticon.vue'
import FlagChip from '../ui/FlagChip.vue'
import Hint from '../ui/Hint.vue'
import Skeleton from '../ui/Skeleton.vue'
import ReviewerChip from '../ui/ReviewerChip.vue'
import SeverityIcon from '../ui/SeverityIcon.vue'
import SortHeader from '../ui/SortHeader.vue'

const props = defineProps<{ agent: AgentDetail; chain: ChainInfo; stats: FeedbackStats; rep: ReputationReport; self: string[] }>()

const { open } = useRowLink()

/** Reviewers looked up across agents and on the explorer, heaviest first. */
const LOOKUP = 12
const SHOWN = 50

/** Score share and leave-one-out pull come from the filtered score, not the legacy row weights. */
const reviewers = computed(() => {
  const byClient = new Map(props.rep.contributions.map((c) => [c.client.toLowerCase(), c]))
  return props.stats.reviewers
    .map((r) => {
      const contribution = byClient.get(r.client.toLowerCase())
      return { ...r, scoreShare: contribution?.share ?? null, scoreWithout: contribution?.without ?? null }
    })
    .sort((a, b) => (b.scoreShare ?? 0) - (a.scoreShare ?? 0) || b.rows - a.rows)
})
const reviewerRows = useSort(reviewers, [
  { key: 'reviewer', value: (r) => r.client },
  { key: 'reviews', value: (r) => r.rows, numeric: true },
  { key: 'weight', value: (r) => r.scoreShare, numeric: true },
  { key: 'average', value: (r) => r.ratingAverage, numeric: true },
  { key: 'without', value: (r) => r.scoreWithout, numeric: true },
])

const insights = reactive(new Map<string, ReviewerInsight>())
const loading = ref(false)
// A newer lookup (another agent) makes the results of an older one stale.
let run = 0

async function lookUp(): Promise<void> {
  const mine = ++run
  loading.value = true
  insights.clear()
  try {
    const { source, rpcClient } = await sourceFor(props.chain)
    const targets = reviewers.value.slice(0, LOOKUP).map((r) => r.client)
    await loadReviewerInsights(props.chain, rpcClient, source, targets, (insight) => {
      if (mine === run) insights.set(insight.address.toLowerCase(), insight)
    })
  } finally {
    if (mine === run) loading.value = false
  }
}
watch(() => [props.chain.chainId, props.agent.tokenId], lookUp, { immediate: true })

const clusters = computed(() =>
  clusterByFunder(
    [...insights.values()].map((i) => ({ reviewer: i.address, funding: i.funding ?? null })),
    props.self,
  ),
)
const fundingChecked = computed(() => [...insights.values()].filter((i) => i.funding !== undefined).length)

function insightOf(address: Address): ReviewerInsight | undefined {
  return insights.get(address.toLowerCase())
}
function isSelf(address: string): boolean {
  return props.self.some((a) => a.toLowerCase() === address.toLowerCase())
}
</script>

<template>
  <p class="muted note">
    How much each address pulls the score, and what it does elsewhere. The top {{ LOOKUP }} by weight are looked up across agents
    <template v-if="chain.explorerApiUrl">and on the block explorer (who first funded them)</template>
    <template v-else>(funding cannot be traced on <ChainName :chain-id="chain.chainId" :name="chain.name" />: no explorer API that allows browser calls)</template>.
    <span v-if="loading" class="muted">Looking up {{ insights.size }}/{{ Math.min(LOOKUP, reviewers.length) }}…</span>
  </p>

  <section v-if="clusters.length" class="panel">
    <h3>Shared funders</h3>
    <table class="signals">
      <caption class="sr-only">Shared funders, by severity</caption>
      <tbody>
        <tr v-for="c in clusters" :key="c.funder" :class="c.self ? 'level-high' : 'level-warn'">
          <td class="signal-level"><SeverityIcon :level="c.self ? 'high' : 'warn'" /></td>
          <td>
            <a :href="addressExplorerUrl(chain, c.funder)" target="_blank" rel="noopener noreferrer" class="address-mark mono">
              <AddressIdenticon :address="c.funder" />
              {{ shortAddress(c.funder) }}
            </a>
            <template v-if="c.self"> — the agent's own address — </template>
            first funded {{ c.reviewers.length }} reviewer{{ c.reviewers.length === 1 ? '' : 's' }}:
            <span v-for="r in c.reviewers" :key="r" class="address-mark mono">
              <AddressIdenticon :address="r" />
              {{ shortAddress(r) }}
            </span>.
            <small v-if="chain.testnet && !c.self" class="muted"> On testnets a faucet often funds many wallets — open the funder before concluding.</small>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
  <p v-else-if="!loading && fundingChecked > 1" class="muted note">No two of the {{ fundingChecked }} traced reviewers share a funder.</p>

  <div class="table-wrap">
    <table class="reviewers-table">
      <thead>
        <tr>
          <SortHeader label="Reviewer" :active="reviewerRows.state('reviewer')" @sort="reviewerRows.toggle('reviewer')" />
          <SortHeader label="Reviews" numeric text="Reviews on this agent (revoked in brackets)" :active="reviewerRows.state('reviews')" @sort="reviewerRows.toggle('reviews')" />
          <SortHeader label="Score share" text="Share of the capped wallet weight behind the Filtered score" :active="reviewerRows.state('weight')" @sort="reviewerRows.toggle('weight')" />
          <SortHeader label="Avg rating" numeric text="Normalised rating average here, with min–max; telemetry and metrics are excluded" :active="reviewerRows.state('average')" @sort="reviewerRows.toggle('average')" />
          <SortHeader label="Score without it" numeric text="Filtered score without this reviewer's wallet minus the score with it" :active="reviewerRows.state('without')" @sort="reviewerRows.toggle('without')" />
          <th>Flags here</th>
          <Hint text="Its feedback on other agents, as far as the source reaches"><th>Elsewhere</th></Hint>
          <Hint text="Transactions sent, and who first sent it funds"><th>Wallet</th></Hint>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in reviewerRows.sorted.value.slice(0, SHOWN)"
          :key="r.client"
          class="row-link"
          role="link"
          tabindex="0"
          :aria-label="`Open reviewer ${shortAddress(r.client)}`"
          @click="open({ name: 'reviewer', params: { slug: chain.slug, address: r.client } }, $event)"
          @keydown.enter.prevent="open({ name: 'reviewer', params: { slug: chain.slug, address: r.client } })"
          @keydown.space.prevent="open({ name: 'reviewer', params: { slug: chain.slug, address: r.client } })"
        >
          <td class="nowrap">
            <span class="address-mark mono" :title="r.client">
              <AddressIdenticon :address="r.client" />
              {{ shortAddress(r.client) }}
            </span>
            <span v-if="isSelf(r.client)" class="chip bad">agent itself</span>
          </td>
          <td class="num">{{ r.rows }}<span v-if="r.revoked" class="muted"> ({{ r.revoked }})</span></td>
          <td>
            <span class="inline-meter" :title="`${formatPercent(r.scoreShare)} of the capped wallet weight, ${formatPercent(r.share)} of counted reviews`">
              <span class="bar-track" aria-hidden="true"><span :style="{ width: `${(r.scoreShare ?? 0) * 100}%` }" /></span>
              {{ r.scoreShare === null ? '—' : formatPercent(r.scoreShare) }}
            </span>
          </td>
          <td class="num">
            {{ r.ratingAverage === null ? '—' : formatNumber(r.ratingAverage) }}
            <small v-if="r.ratingMin !== null && r.ratingMin !== r.ratingMax" class="muted">{{ formatNumber(r.ratingMin) }}–{{ formatNumber(r.ratingMax) }}</small>
          </td>
          <td class="num">{{ formatSigned(r.scoreWithout) }}</td>
          <td>
            <Hint v-for="flag in r.flags" :key="flag" :text="FLAG_INFO[flag].rule">
              <FlagChip :flag="flag" />
            </Hint>
          </td>
          <td>
            <template v-if="insightOf(r.client)?.profile">
              <span class="nowrap">
                {{ insightOf(r.client)!.profile!.agents }} agent{{ insightOf(r.client)!.profile!.agents === 1 ? '' : 's' }} ·
                rating avg {{ formatNumber(insightOf(r.client)!.profile!.ratingAverage) }}<template v-if="insightOf(r.client)!.truncated">+</template>
              </span>
              <Hint
                v-for="label in insightOf(r.client)!.profile!.labels"
                :key="label"
                :text="LABEL_INFO[label].rule"
              >
                <ReviewerChip :label="label" />
              </Hint>
            </template>
            <Hint v-else-if="insightOf(r.client)" :text="insightOf(r.client)!.errors.join('\n')">
              <span class="muted">unavailable</span>
            </Hint>
            <Skeleton v-else-if="reviewers.indexOf(r) < LOOKUP && loading" width="8em" />
            <span v-else class="muted">open profile</span>
          </td>
          <td class="nowrap">
            <Skeleton v-if="!insightOf(r.client) && reviewers.indexOf(r) < LOOKUP && loading" width="6em" />
            <template v-else-if="insightOf(r.client)">
              <span
                v-if="insightOf(r.client)!.nonce !== undefined"
                :class="{ 'chip warn': insightOf(r.client)!.nonce! < MIN_NONCE }"
                :title="`Transactions sent; under ${MIN_NONCE} is a fresh wallet`"
              >
                {{ insightOf(r.client)!.nonce }} tx
              </span>
              <template v-if="insightOf(r.client)!.funding">
                · from
                <a
                  :href="txExplorerUrl(chain, insightOf(r.client)!.funding!.txHash)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="address-mark mono"
                  :title="`First funded ${insightOf(r.client)!.funding!.timestamp ? formatDate(insightOf(r.client)!.funding!.timestamp!) : ''} by ${insightOf(r.client)!.funding!.funder}`"
                >
                  <AddressIdenticon :address="insightOf(r.client)!.funding!.funder" />
                  {{ shortAddress(insightOf(r.client)!.funding!.funder) }}
                </a>
              </template>
              <span v-else-if="insightOf(r.client)!.funding === null" class="muted"> · funder not found</span>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-if="reviewers.length > SHOWN" class="muted note">Top {{ SHOWN }} of {{ reviewers.length }} reviewers by weight.</p>
</template>
