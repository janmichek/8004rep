<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatNumber, formatScore } from '../../format'
import { rankScore } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useAgentList, useChain, useEcosystem, useFiles, usePageQuery } from '../shared/use'
import { tierOf } from './league'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const ecosystem = useEcosystem()
const squad = computed(() =>
  (data.value?.items ?? [])
    .map((a) => {
      const s = scores.value?.get(a.tokenId)
      const pts = rankScore(s, ecosystem.data.value?.averageFeedback ?? 50)
      return { a, s, pts, tier: tierOf(pts, s?.count ?? 0) }
    })
    .sort((x, y) => (y.pts ?? -1) - (x.pts ?? -1)),
)
const clubPts = computed(() => {
  const r = squad.value.filter((x) => x.pts !== null)
  return r.length ? r.reduce((n, x) => n + x.pts!, 0) / r.length : null
})
</script>

<template>
  <p v-if="!address" class="g-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <h1 class="g-title"><small>Club · {{ chain.name }}</small><span class="mono" style="font-size: 0.5em">{{ address }}</span></h1>
    <p><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="volt">Explorer ↗</a></p>
    <div class="g-stats">
      <div class="g-stat"><b>{{ data?.total ?? '…' }}</b><small>Squad size</small></div>
      <div class="g-stat"><b class="volt">{{ formatNumber(clubPts) }}</b><small>Club pts (mean)</small></div>
      <div class="g-stat"><b>{{ squad.filter((x) => x.tier === 'Gold').length }}</b><small>Gold players</small></div>
    </div>
    <p v-if="error" class="g-notice">{{ error }}</p>
    <p v-else-if="loading || !data" class="soft">Loading squad…</p>
    <p v-else-if="!data.items.length" class="soft">{{ page > 0 ? 'No more players.' : 'Empty squad on this network.' }}</p>
    <section v-else class="g-panel">
      <h3>Squad</h3>
      <table class="g-table">
        <tbody>
          <tr v-for="(r, i) in squad" :key="r.a.tokenId.toString()">
            <td class="g-pos">{{ i + 1 }}</td>
            <td><RouterLink :to="to.agent(r.a.tokenId)" style="display: inline-flex; gap: 8px; align-items: center"><Sigil :seed="`${r.a.chainId}:${r.a.tokenId}`" :image="files.get(r.a.tokenId)?.image" :size="26" round /><b>{{ files.get(r.a.tokenId)?.name ?? `Agent #${r.a.tokenId}` }}</b></RouterLink></td>
            <td><span class="g-tier" :class="r.tier">{{ r.tier }}</span></td>
            <td class="num">{{ r.s?.count ?? '…' }} played</td>
            <td class="num">{{ r.s?.count ? formatScore(r.s.average) : '–' }}</td>
            <td class="num g-pts">{{ formatNumber(r.pts) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="page > 0 || data.hasMore" style="text-align: center">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
      </p>
    </section>
  </template>
</template>
