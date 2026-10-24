<script setup lang="ts">
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatScore } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
</script>

<template>
  <p v-if="!address" class="d-error">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="d-kicker">Counsel of record</p>
    <h1 class="d-h1">Estate under {{ address.slice(0, 6) }}…{{ address.slice(-4) }}</h1>
    <p class="d-lede">
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="d-mono">{{ address }}</a>
      holds {{ data?.total ?? '…' }} cause{{ data?.total === 1 ? '' : 's' }} in {{ chain.name }}.
    </p>
    <p v-if="error" class="d-error">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="d-empty">Reading the estate…</p>
    <template v-else-if="data.items.length">
      <table class="d-table">
        <thead><tr><th>Cause</th><th>Party</th><th class="num">Testimony</th><th class="num">Standing</th><th class="num">Filed</th></tr></thead>
        <tbody>
          <tr v-for="a in data.items" :key="a.tokenId.toString()">
            <td class="d-case-no">No. {{ a.tokenId }}</td>
            <td><RouterLink :to="to.agent(a.tokenId)" class="who">{{ files.get(a.tokenId)?.name ?? `Agent ${a.tokenId}` }}</RouterLink></td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ?? '…' }}</td>
            <td class="num"><b>{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</b></td>
            <td class="num soft">{{ a.createdAt ? formatDate(a.createdAt) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="d-motif">
        Estate mean:
        {{ formatNumber((data.items.reduce((n, a) => n + (scores?.get(a.tokenId)?.average ?? 0), 0) / Math.max(1, data.items.filter((a) => scores?.get(a.tokenId)?.count).length))) }}
        across the causes on this page.
      </p>
      <nav v-if="page > 0 || data.hasMore" class="d-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Earlier</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">Later →</RouterLink><span v-else />
      </nav>
    </template>
    <p v-else class="d-empty">No causes are held by this address.</p>
  </template>
</template>
