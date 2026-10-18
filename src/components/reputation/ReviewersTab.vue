<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { Address } from 'viem'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../../chains'
import { sourceFor } from '../../data'
import { FLAG_INFO, type FeedbackStats } from '../../data/feedbackStats'
import { clusterByFunder } from '../../data/funding'
import { loadReviewerInsights, type ReviewerInsight } from '../../data/reviewerInsights'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import type { AgentDetail } from '../../data/types'
import { formatDate, formatNumber, formatPercent, formatSigned, shortAddress } from '../../format'

const props = defineProps<{ agent: AgentDetail; chain: ChainInfo; stats: FeedbackStats; self: string[] }>()

/** Reviewers looked up across agents and on the explorer, heaviest first. */
const LOOKUP = 12
const SHOWN = 50

const reviewers = computed(() => [...props.stats.reviewers].sort((a, b) => (b.weightShare ?? 0) - (a.weightShare ?? 0) || b.rows - a.rows))
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
    <template v-else>(funding cannot be traced on {{ chain.name }}: no explorer API that allows browser calls)</template>.
    <span v-if="loading" class="muted">Looking up {{ insights.size }}/{{ Math.min(LOOKUP, reviewers.length) }}…</span>
  </p>

  <section v-if="clusters.length" class="panel">
    <h3>Shared funders</h3>
    <ul class="signals">
      <li v-for="c in clusters" :key="c.funder" :class="c.self ? 'level-high' : 'level-warn'">
        <span class="signal-level">{{ c.self ? 'high' : 'warn' }}</span>
        <span>
          <a :href="addressExplorerUrl(chain, c.funder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(c.funder) }}</a>
          <template v-if="c.self"> — the agent's own address — </template>
          first funded {{ c.reviewers.length }} reviewer{{ c.reviewers.length === 1 ? '' : 's' }}:
          <span v-for="r in c.reviewers" :key="r" class="mono"> {{ shortAddress(r) }}</span>.
          <small v-if="chain.testnet && !c.self" class="muted"> On testnets a faucet often funds many wallets — open the funder before concluding.</small>
        </span>
      </li>
    </ul>
  </section>
  <p v-else-if="!loading && fundingChecked > 1" class="muted note">No two of the {{ fundingChecked }} traced reviewers share a funder.</p>

  <div class="table-wrap">
    <table class="reviewers-table">
      <thead>
        <tr>
          <th>Reviewer</th>
          <th class="num" title="Rows on this agent (revoked in brackets)">Rows</th>
          <th title="Share of the authenticity weight — pull on the trusted score">Weight share</th>
          <th class="num" title="Average of its non-revoked values here, with min–max">Avg here</th>
          <th class="num" title="Raw average without this reviewer minus with it">Without it</th>
          <th>Flags here</th>
          <th title="Its feedback on other agents, as far as the source reaches">Elsewhere</th>
          <th title="Transactions sent, and who first sent it funds">Wallet</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in reviewers.slice(0, SHOWN)" :key="r.client">
          <td class="nowrap">
            <RouterLink :to="{ name: 'reviewer', params: { slug: chain.slug, address: r.client } }" class="mono" :title="r.client">
              {{ shortAddress(r.client) }}
            </RouterLink>
            <span v-if="isSelf(r.client)" class="chip bad">agent itself</span>
          </td>
          <td class="num">{{ r.rows }}<span v-if="r.revoked" class="muted"> ({{ r.revoked }})</span></td>
          <td>
            <span class="inline-meter" :title="`${formatPercent(r.weightShare)} of the weight, ${formatPercent(r.share)} of counted rows`">
              <span class="bar-track" aria-hidden="true"><span :style="{ width: `${(r.weightShare ?? 0) * 100}%` }" /></span>
              {{ formatPercent(r.weightShare) }}
            </span>
          </td>
          <td class="num">
            {{ formatNumber(r.average) }}
            <small v-if="r.min !== null && r.min !== r.max" class="muted">{{ formatNumber(r.min) }}–{{ formatNumber(r.max) }}</small>
          </td>
          <td class="num">{{ formatSigned(r.shiftWithout) }}</td>
          <td>
            <span v-for="flag in r.flags" :key="flag" class="chip warn" :title="FLAG_INFO[flag].rule">{{ FLAG_INFO[flag].label }}</span>
          </td>
          <td>
            <template v-if="insightOf(r.client)?.profile">
              <span class="nowrap">
                {{ insightOf(r.client)!.profile!.agents }} agent{{ insightOf(r.client)!.profile!.agents === 1 ? '' : 's' }} ·
                avg {{ formatNumber(insightOf(r.client)!.profile!.average) }}<template v-if="insightOf(r.client)!.truncated">+</template>
              </span>
              <span
                v-for="label in insightOf(r.client)!.profile!.labels"
                :key="label"
                class="chip"
                :class="LABEL_INFO[label].tone === 'warn' ? 'warn' : ''"
                :title="LABEL_INFO[label].rule"
              >
                {{ LABEL_INFO[label].label }}
              </span>
            </template>
            <span v-else-if="insightOf(r.client)" class="muted" :title="insightOf(r.client)!.errors.join('\n')">unavailable</span>
            <span v-else-if="reviewers.indexOf(r) < LOOKUP && loading" class="muted">…</span>
            <span v-else class="muted">open profile</span>
          </td>
          <td class="nowrap">
            <template v-if="insightOf(r.client)">
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
                  class="mono"
                  :title="`First funded ${insightOf(r.client)!.funding!.timestamp ? formatDate(insightOf(r.client)!.funding!.timestamp!) : ''} by ${insightOf(r.client)!.funding!.funder}`"
                >
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
