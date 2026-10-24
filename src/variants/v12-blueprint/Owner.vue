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
  <p v-if="!address" class="bp-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="bp-kicker">Supplier file</p>
    <h1 class="bp-h1">Parts issued under {{ address.slice(0, 6) }}…{{ address.slice(-4) }}</h1>
    <p class="bp-prose"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="bp-mono">{{ address }}</a> is the supplier of record for {{ data?.total ?? '…' }} assembly{{ data?.total === 1 ? '' : 'ies' }} on {{ chain.name }}.</p>
    <p v-if="error" class="bp-err">{{ error }} <button @click="reload">RETRY</button></p>
    <p v-else-if="loading || !data" class="bp-empty">Reading the file…</p>
    <p v-else-if="!data.items.length" class="bp-empty">No parts under this supplier.</p>
    <template v-else>
      <table class="bp-table">
        <thead><tr><th>Part no.</th><th>Description</th><th class="num">Certificates</th><th class="num">Rating</th><th class="num">Issued</th></tr></thead>
        <tbody>
          <tr v-for="a in data.items" :key="a.tokenId.toString()">
            <td class="part"><RouterLink :to="to.agent(a.tokenId)">{{ a.tokenId }}</RouterLink></td>
            <td><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `Agent ${a.tokenId}` }}</RouterLink></td>
            <td class="num">{{ scores?.get(a.tokenId)?.count ?? '…' }}</td>
            <td class="num"><b>{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</b></td>
            <td class="num dim">{{ a.createdAt ? formatDate(a.createdAt) : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="bp-note">
        Page mean {{ formatNumber(data.items.reduce((n, a) => n + (scores?.get(a.tokenId)?.average ?? 0), 0) / Math.max(1, data.items.filter((a) => scores?.get(a.tokenId)?.count).length)) }}
        over the rated parts shown.
      </p>
      <nav v-if="page > 0 || data.hasMore" class="bp-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← PREVIOUS</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">NEXT →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
