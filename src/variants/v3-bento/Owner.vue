<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatNumber } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import Ring from './Ring.vue'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const agg = computed(() => {
  if (!scores.value) return undefined
  const rated = (data.value?.items ?? []).map((a) => scores.value!.get(a.tokenId)).filter((s) => s?.count)
  const reviews = rated.reduce((n, s) => n + s!.count, 0)
  return { rated: rated.length, reviews, weighted: reviews ? rated.reduce((n, s) => n + s!.count * s!.average, 0) / reviews : null }
})
</script>

<template>
  <p v-if="!address" class="b-notice">“{{ props.address }}” is not a 0x address.</p>
  <div v-else class="b-grid">
    <section class="b-card s6 b-row" style="gap: 16px">
      <Sigil :seed="address" :size="72" round />
      <div style="min-width: 0">
        <h3>Owner</h3>
        <p class="b-mono" style="word-break: break-all; margin: 0">{{ address }}</p>
        <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="b-pill">Explorer ↗</a>
      </div>
    </section>
    <section class="b-card s2"><h3>Owned</h3><p class="b-big">{{ data?.total ?? '…' }}</p></section>
    <section class="b-card s2"><h3>Rated</h3><p class="b-big">{{ agg?.rated ?? '…' }}</p></section>
    <section class="b-card s2 b-dark" style="text-align: center"><Ring :value="agg?.weighted ?? null" :size="96" color="#18b39a" label="per review" /></section>
    <p v-if="error" class="b-notice s12">{{ error }}</p>
    <p v-else-if="loading || !data" class="soft s12">Loading…</p>
    <section v-else-if="!data.items.length" class="b-card s12">{{ page > 0 ? 'No more agents.' : `Owns no agents on ${chain.name}.` }}</section>
    <div v-else class="b-tiles" style="grid-column: 1 / -1">
      <RouterLink v-for="a in data.items" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="b-tile">
        <div class="b-row">
          <Sigil :seed="`${a.chainId}:${a.tokenId}`" :image="files.get(a.tokenId)?.image" :size="40" />
          <div class="name" style="flex: 1">{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</div>
          <Ring :value="scores?.get(a.tokenId)?.count ? scores.get(a.tokenId)!.average : null" :size="46" />
        </div>
        <span class="soft">{{ scores?.get(a.tokenId)?.count ?? '…' }} reviews · avg {{ formatNumber(scores?.get(a.tokenId)?.average) }}</span>
      </RouterLink>
    </div>
    <nav v-if="data && (page > 0 || data.hasMore)" class="b-pager s12">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
      <span class="soft">Page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
    </nav>
  </div>
</template>
