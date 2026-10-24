<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatNumber, formatScore } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { provisionalGrade } from './grade'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
// Exposure: share of guaranteed subjects graded D or worse.
const exposure = computed(() => {
  if (!scores.value || !data.value?.items.length) return undefined
  const graded = data.value.items.map((a) => provisionalGrade(scores.value!.get(a.tokenId))).filter((g) => g !== 'NR')
  return { graded: graded.length, adverse: graded.filter((g) => g === 'D' || g === 'F').length }
})
</script>

<template>
  <p v-if="!address" class="u-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <section class="u-sec">
      <h2><span>§G</span> Guarantor file</h2>
      <div class="u-fields">
        <div class="u-field" style="grid-column: span 2"><label>Address</label><div><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ address }}</a></div></div>
        <div class="u-field"><label>Subjects guaranteed</label><div>{{ data?.total ?? '…' }}</div></div>
        <div class="u-field"><label>Graded / adverse</label><div>{{ exposure ? `${exposure.graded} / ${exposure.adverse}` : '…' }}</div></div>
      </div>
    </section>
    <section class="u-sec">
      <h2><span>§G.1</span> Subjects</h2>
      <p v-if="error" class="u-notice">{{ error }}</p>
      <p v-else-if="loading || !data" class="soft mono">Retrieving…</p>
      <p v-else-if="!data.items.length" class="mono soft">{{ page > 0 ? 'NO FURTHER SUBJECTS' : 'NONE ON THIS NETWORK' }}</p>
      <table v-else class="u-table">
        <thead><tr><th>Grade</th><th>Subject</th><th class="num">ID</th><th class="num">Reports</th><th class="num">Avg</th></tr></thead>
        <tbody>
          <tr v-for="a in data.items" :key="a.tokenId.toString()">
            <td><b :class="`u-g-${provisionalGrade(scores?.get(a.tokenId))}`">{{ scores ? provisionalGrade(scores.get(a.tokenId)) : '…' }}</b></td>
            <td><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `AGENT ${a.tokenId}` }}</RouterLink></td>
            <td class="num">{{ a.tokenId }}</td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ?? '…' }}</td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : formatNumber(null) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="data && (page > 0 || data.hasMore)" style="display: flex; gap: 8px">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
      </p>
    </section>
  </template>
</template>
