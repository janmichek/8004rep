<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AgentSummary } from '../../data/types'
import { formatScore } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import AgentPane from './AgentPane.vue'
import List from './List.vue'

// Serves both /agents/:slug and /agents/:slug/:id; the id is the selection.
const props = defineProps<{ slug: string; id?: string }>()
const chain = useChain(() => props.slug)
const route = useRoute()
const router = useRouter()
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
function select(a: AgentSummary): void {
  void router.replace({ name: 'agent', params: { slug: props.slug, id: a.tokenId.toString() }, query: route.query })
}
</script>

<template>
  <div class="i-split">
    <section class="i-list">
      <header>
        <h2><span>Agents</span><span class="soft">{{ data?.total ?? '' }}</span></h2>
        <form @submit.prevent="setSearch(input)"><input v-model="input" type="search" placeholder="Search name or ID ⏎" aria-label="Search agents" style="width: 100%" /></form>
      </header>
      <p v-if="searchIgnored" class="i-notice">Token IDs only on {{ chain.name }}.</p>
      <p v-if="error" class="i-notice">{{ error }} <button @click="reload">Retry</button></p>
      <p v-else-if="loading || !data" class="soft" style="padding: 12px">Loading…</p>
      <p v-else-if="!data.items.length" class="soft" style="padding: 12px">{{ search ? `No match for “${search}”.` : 'No agents.' }}</p>
      <List v-else :items="data.items" :key-of="(a) => a.tokenId.toString()" :selected="id" @select="select">
        <template #default="{ item: a }">
          <Sigil :seed="`${a.chainId}:${a.tokenId}`" :image="files.get(a.tokenId)?.image" :size="30" />
          <div class="main"><b>{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</b><span class="soft">#{{ a.tokenId }} · {{ scores?.get(a.tokenId)?.count ?? '…' }} reviews</span></div>
          <span class="i-num">{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</span>
        </template>
        <template #after>
          <div v-if="page > 0 || data.hasMore" style="display: flex; justify-content: space-between; padding: 10px 12px">
            <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Newer</RouterLink><span v-else />
            <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Older →</RouterLink>
          </div>
        </template>
      </List>
    </section>
    <section class="i-detail">
      <AgentPane v-if="id" :key="id" :chain="chain" :id="id" />
      <div v-else class="i-empty"><div>Select an agent · <span class="i-kbd"><kbd>↑</kbd><kbd>↓</kbd> in the list</span></div></div>
    </section>
  </div>
</template>
