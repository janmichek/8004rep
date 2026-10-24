<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { ratingOf, symbolOf } from './market'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, computed(() => ''), address)
const files = useFiles(() => data.value?.items)
const positions = computed(() => {
  const items = data.value?.items ?? []
  const total = items.length || 1
  return items.map((a) => {
    const s = scores.value?.get(a.tokenId)
    return {
      a,
      s,
      name: files.value.get(a.tokenId)?.name,
      sym: symbolOf(files.value.get(a.tokenId)?.name, a.tokenId),
      rating: ratingOf(s?.average),
      weight: 1 / total,
    }
  })
})
const mean = computed(() => {
  const live = positions.value.filter((p) => p.s?.count)
  return live.length ? live.reduce((n, p) => n + (p.s?.average ?? 0), 0) / live.length : null
})
const totalTrades = computed(() => positions.value.reduce((n, p) => n + (p.s?.count ?? 0), 0))
</script>

<template>
  <p v-if="!address" class="t-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="t-kicker">PORTFOLIO</p>
    <h1 class="t-h1">Holdings of {{ shortAddress(address) }}</h1>
    <p class="t-lede">
      {{ data?.total ?? '…' }} listings under one owner in {{ chain.name }}. Weights are equal across the holdings shown;
      the last price is each listing's on-chain mean.
    </p>
    <p v-if="error" class="t-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="t-empty">LOADING BOOK…</p>
    <p v-else-if="!data.items.length" class="t-empty">NO POSITIONS</p>
    <template v-else>
      <div class="t-tiles">
        <div><small>Positions</small><b>{{ data.items.length }}</b></div>
        <div><small>Mean last</small><b>{{ formatNumber(mean) }}</b></div>
        <div><small>Trades behind</small><b>{{ totalTrades }}</b></div>
        <div><small>Owner</small><b style="font-size: 14px"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ shortAddress(address) }}</a></b></div>
      </div>

      <h2 class="t-h2">Book</h2>
      <table class="t-table">
        <thead><tr><th>Symbol</th><th>Listing</th><th class="num">Last</th><th class="num">Volume</th><th>Grade</th><th class="num">Weight</th><th>Listed</th><th class="num">Px bar</th></tr></thead>
        <tbody>
          <tr v-for="p in positions" :key="p.a.tokenId.toString()">
            <td class="t-sym"><RouterLink :to="to.agent(p.a.tokenId)">{{ p.sym }}</RouterLink></td>
            <td><RouterLink :to="to.agent(p.a.tokenId)">{{ p.name ?? `Agent ${p.a.tokenId}` }}</RouterLink> <span class="t-dim">#{{ p.a.tokenId }}</span></td>
            <td class="num" :class="p.s?.count ? (p.s.average >= 80 ? 't-up' : p.s.average < 40 ? 't-down' : '') : 't-dim'">{{ p.s?.count ? formatScore(p.s.average) : '—' }}</td>
            <td class="num">{{ p.s?.count ?? 0 }}</td>
            <td><span class="t-badge">{{ p.rating }}</span></td>
            <td class="num">{{ formatPercent(p.weight) }}</td>
            <td class="t-dim">{{ p.a.createdAt ? formatDate(p.a.createdAt) : '—' }}</td>
            <td class="num">
              <span style="display: inline-block; width: 62px; height: 5px; background: #16211f; vertical-align: middle">
                <span :style="{ display: 'block', height: '100%', width: `${p.s?.average ?? 0}%`, background: (p.s?.average ?? 0) >= 60 ? 'var(--t-up)' : 'var(--t-down)' }" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <nav v-if="page > 0 || data.hasMore" class="t-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← PREV</RouterLink><span v-else />
        <span class="t-dim">PAGE {{ page + 1 }}</span>
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">NEXT →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
