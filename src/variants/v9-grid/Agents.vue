<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AgentSummary } from '../../data/types'
import { formatDate, shortAddress } from '../../format'
import { rankScore } from '../shared/metrics'
import { routes, useAgentList, useChain, useEcosystem, useFiles, usePageQuery } from '../shared/use'
import Sheet from './Sheet.vue'
import type { Column } from './sheet'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const ecosystem = useEcosystem()
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

const s = (a: AgentSummary) => scores.value?.get(a.tokenId)
const f = (a: AgentSummary) => files.value.get(a.tokenId)
const columns = computed<Column<AgentSummary>[]>(() => [
  { key: 'id', label: 'Token ID', get: (a) => Number(a.tokenId), num: true, formula: 'identityRegistry.tokenId' },
  { key: 'name', label: 'Name', get: (a) => f(a)?.name ?? `Agent #${a.tokenId}`, link: (a) => to.agent(a.tokenId), formula: 'registrationFile.name', width: '180px' },
  { key: 'owner', label: 'Owner', get: (a) => a.owner, show: (a) => (a.owner ? shortAddress(a.owner) : ''), link: (a) => (a.owner ? to.owner(a.owner) : undefined), formula: 'ownerOf(tokenId)' },
  { key: 'n', label: 'Reviews', get: (a) => s(a)?.count, num: true, formula: 'getSummary(tokenId, getClients(tokenId)).count' },
  { key: 'avg', label: 'Average', get: (a) => (s(a)?.count ? s(a)!.average : null), num: true, formula: 'getSummary(…).summaryValue / 10^decimals', tone: (a) => (s(a)?.count ? (s(a)!.average >= 80 ? 'good' : s(a)!.average < 50 ? 'bad' : undefined) : undefined) },
  { key: 'rank', label: 'Rank score', get: (a) => rankScore(s(a), ecosystem.data.value?.averageFeedback ?? 50), num: true, formula: '(n·avg + 5·ecosystemAvg) / (n + 5)' },
  { key: 'created', label: 'Created', get: (a) => a.createdAt, show: (a) => (a.createdAt ? formatDate(a.createdAt) : ''), num: true, formula: 'subgraph.agent.createdAt (indexed sources only)' },
  { key: 'active', label: 'Active', get: (a) => (f(a)?.active === undefined ? null : f(a)!.active ? 'TRUE' : 'FALSE'), formula: 'registrationFile.active' },
  { key: 'x402', label: 'x402', get: (a) => (f(a)?.x402Support ? 'TRUE' : f(a) ? 'FALSE' : null), formula: 'registrationFile.x402Support' },
  { key: 'svc', label: 'Services', get: (a) => f(a)?.services.length, num: true, formula: 'COUNT(registrationFile.services)', hidden: true },
  { key: 'trust', label: 'Trust models', get: (a) => f(a)?.supportedTrust.join(', '), formula: 'registrationFile.supportedTrust', hidden: true },
  { key: 'desc', label: 'Description', get: (a) => f(a)?.description, formula: 'registrationFile.description', hidden: true, width: '260px' },
  { key: 'uri', label: 'Agent URI', get: (a) => a.agentURI, formula: 'tokenURI(tokenId)', hidden: true },
])
</script>

<template>
  <div class="x-title">
    <h1>Agents · {{ chain.name }}</h1>
    <span class="soft">{{ data?.total !== undefined ? `${data.total} registered` : '' }} · page {{ page + 1 }} · sort and filter apply to this page</span>
    <form style="display: flex; gap: 6px; margin-left: auto" @submit.prevent="setSearch(input)">
      <input v-model="input" type="search" placeholder="Search name or ID" aria-label="Search agents" />
      <button type="submit">Search</button>
    </form>
  </div>
  <p v-if="searchIgnored" class="x-note">Name search needs an indexed network; {{ chain.name }} matches token IDs only. Showing all.</p>
  <p v-if="error" class="x-note">#ERROR! {{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="soft">Calculating…</p>
  <p v-else-if="!data.items.length" class="x-note">#N/A — {{ search ? `no agent matches “${search}”` : 'no agents' }}</p>
  <template v-else>
    <Sheet :rows="data.items" :columns="columns" :name="`agents-${chain.slug}-p${page + 1}`" @select="(a) => $router.push(to.agent(a.tokenId))" />
    <div v-if="page > 0 || data.hasMore" class="x-pager">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
      <span class="soft">Page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
    </div>
  </template>
</template>
