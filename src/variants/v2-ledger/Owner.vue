<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const rated = computed(() => (data.value?.items ?? []).filter((a) => scores.value?.get(a.tokenId)?.count))
const best = computed(() => [...rated.value].sort((a, b) => scores.value!.get(b.tokenId)!.average - scores.value!.get(a.tokenId)!.average)[0])
const worst = computed(() => [...rated.value].sort((a, b) => scores.value!.get(a.tokenId)!.average - scores.value!.get(b.tokenId)!.average)[0])
</script>

<template>
  <p v-if="!address" class="l-notice">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="l-kicker">Business · Holdings</p>
    <h2 class="l-head">The portfolio of <span class="l-mono" style="font-size: 0.6em">{{ shortAddress(address) }}</span></h2>
    <p class="l-deck">
      <template v-if="data">Owner of {{ data.total ?? data.items.length }} agent{{ (data.total ?? data.items.length) === 1 ? '' : 's' }} on {{ chain.name }}.</template>
      <template v-if="best && worst && best !== worst">
        Its best-rated is {{ files.get(best.tokenId)?.name ?? `No. ${best.tokenId}` }} ({{ formatScore(scores!.get(best.tokenId)!.average) }}); its weakest,
        {{ files.get(worst.tokenId)?.name ?? `No. ${worst.tokenId}` }} ({{ formatScore(scores!.get(worst.tokenId)!.average) }}).
      </template>
    </p>
    <p class="l-byline"><span class="l-mono">{{ address }}</span> · <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a></p>
    <p v-if="error" class="l-notice">{{ error }}</p>
    <p v-else-if="loading || !data" class="l-deck">Checking the books…</p>
    <p v-else-if="!data.items.length" class="l-deck">{{ page > 0 ? 'No further holdings.' : 'No holdings on this network.' }}</p>
    <template v-else>
      <table class="l-table">
        <thead><tr><th>Holding</th><th class="num">No.</th><th class="num">Reviews</th><th class="num">Rating</th></tr></thead>
        <tbody>
          <tr v-for="a in data.items" :key="a.tokenId.toString()">
            <td><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `Agent No. ${a.tokenId}` }}</RouterLink></td>
            <td class="num">{{ a.tokenId }}</td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ?? '…' }}</td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ? formatNumber(scores.get(a.tokenId)!.average) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <nav v-if="page > 0 || data.hasMore" class="l-pager">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink><span v-else />
        <span>Page {{ page + 1 }}</span>
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
