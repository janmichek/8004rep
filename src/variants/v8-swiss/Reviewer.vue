<script setup lang="ts">
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatNumber, formatPercent, formatScore, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
</script>

<template>
  <p v-if="!address" class="w-sentence w-red">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="w-label" style="margin-top: 36px"><RouterLink :to="to.network()">Network</RouterLink> / reviewer</p>
    <p class="mono" style="margin: 6px 0 0"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ address }}</a></p>
    <p v-if="error" class="w-red">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="w-hero soft">…</p>
    <template v-if="profile && feed">
      <div class="w-grid">
        <p class="w-hero" style="grid-column: span 6" :class="{ 'w-red': profile.labels.length }">{{ profile.rows }}</p>
        <div style="grid-column: span 6; align-self: end">
          <p class="w-sentence">reviews of {{ profile.agents }} agents, averaging {{ formatNumber(profile.average) }}<template v-if="profile.mode">, {{ formatPercent(profile.mode.share) }} of them a {{ formatScore(profile.mode.value) }}</template>.</p>
          <p class="soft">{{ wallet.data.value ? `${wallet.data.value.nonce ?? '?'} transactions sent · ${wallet.data.value.kind ?? ''}` : '' }}</p>
        </div>
      </div>
      <p v-for="l in profile.labels" :key="l" style="margin: 0 0 6px"><b class="w-red">{{ LABEL_INFO[l].label }}</b>&emsp;{{ LABEL_INFO[l].rule }}</p>
      <h2 class="w-h">Agents</h2>
      <div v-for="a in profile.perAgent" :key="a.tokenId.toString()" class="w-row" style="grid-template-columns: 4fr 1fr 1fr">
        <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink><span class="r">{{ a.rows }}</span><span class="r"><b>{{ formatNumber(a.average) }}</b></span>
      </div>
      <h2 class="w-h">Latest</h2>
      <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="w-row" style="grid-template-columns: 4fr 1fr 1fr" :class="{ revoked: r.revoked }">
        <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink><span class="r"><b>{{ formatScore(r.value) }}</b></span><span class="r soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
      </div>
      <p><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading' : 'Load older' }}</button></p>
    </template>
  </template>
</template>
