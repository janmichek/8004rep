<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatScore } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { confidenceOf, starsOf } from './taste'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, computed(() => ''), address)
const files = useFiles(() => data.value?.items)
const mean = computed(() => {
  const live = (data.value?.items ?? []).filter((a) => scores.value?.get(a.tokenId)?.count)
  return live.length ? live.reduce((n, a) => n + (scores.value?.get(a.tokenId)?.average ?? 0), 0) / live.length : null
})
</script>

<template>
  <p v-if="!address" class="r-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="r-kicker">The chef's pages</p>
    <h1 class="r-h1">{{ data?.total ?? '…' }} dishes from one kitchen</h1>
    <p class="r-lede">
      Mean tasting <b>{{ mean === null ? '—' : formatNumber(mean) }}</b>. Address
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="r-mono">{{ address }}</a>
    </p>
    <p v-if="error" class="r-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="r-empty">Turning the pages…</p>
    <p v-else-if="!data.items.length" class="r-empty">This chef has no dishes on this menu.</p>
    <template v-else>
      <ul class="r-grid">
        <li v-for="a in data.items" :key="a.tokenId.toString()" class="r-card">
          <div>
            <div class="r-dish"><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `Dish ${a.tokenId}` }}</RouterLink></div>
            <div class="r-sub">No. {{ a.tokenId }} · added {{ a.createdAt ? formatDate(a.createdAt) : 'undated' }}</div>
          </div>
          <div class="r-stars">
            <span v-for="(star, i) in starsOf(scores?.get(a.tokenId)?.average)" :key="i" :class="{ off: star === 'off' }">{{ star === 'off' ? '☆' : '★' }}</span>
            <span class="r-sub" style="margin-left: 6px">{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</span>
          </div>
          <p class="r-desc">{{ files.get(a.tokenId)?.description ?? 'No headnote on the card.' }}</p>
          <div class="r-meta">
            <span>{{ confidenceOf(scores?.get(a.tokenId)?.count).word }}</span>
            <span>{{ scores?.get(a.tokenId)?.count ?? 0 }} tastings</span>
          </div>
        </li>
      </ul>
      <nav v-if="page > 0 || data.hasMore" class="r-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Earlier pages</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">Later pages →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
