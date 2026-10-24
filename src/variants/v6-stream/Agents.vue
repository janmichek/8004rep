<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
</script>

<template>
  <main class="s-main">
    <header class="s-head">
      <form @submit.prevent="setSearch(input)"><input v-model="input" type="search" placeholder="Search agents" aria-label="Search agents" /></form>
    </header>
    <p v-if="searchIgnored" class="s-empty">Name search isn't available on {{ chain.name }} — try a token ID.</p>
    <p v-if="error" class="s-empty">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="s-empty">Loading…</p>
    <p v-else-if="!data.items.length" class="s-empty">{{ search ? `No results for “${search}”` : 'Nobody here yet.' }}</p>
    <template v-else>
      <article v-for="a in data.items" :key="a.tokenId.toString()" class="s-post">
        <Sigil :seed="`${a.chainId}:${a.tokenId}`" :image="files.get(a.tokenId)?.image" :size="48" round />
        <div class="body">
          <div class="who">
            <RouterLink :to="to.agent(a.tokenId)"><b>{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</b></RouterLink>
            <span>@{{ a.tokenId }}</span>
            <span v-if="files.get(a.tokenId)?.active" class="s-badge ok">active</span>
            <span v-if="files.get(a.tokenId)?.x402Support" class="s-badge">x402</span>
          </div>
          <p class="text" style="color: var(--ink)">{{ files.get(a.tokenId)?.description ?? '' }}</p>
          <div class="s-actions">
            <span>★ {{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</span>
            <span>💬 {{ scores?.get(a.tokenId)?.count ?? '…' }} reviews</span>
            <span v-if="a.createdAt">📅 joined {{ formatDate(a.createdAt) }}</span>
            <RouterLink v-if="a.owner" :to="to.owner(a.owner)" class="mono">by {{ shortAddress(a.owner) }}</RouterLink>
          </div>
        </div>
      </article>
      <div v-if="page > 0 || data.hasMore" style="display: flex; justify-content: space-between; padding: 12px 16px">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink>
      </div>
    </template>
  </main>
  <aside class="s-right">
    <div class="s-box">
      <h2>{{ chain.name }}</h2>
      <p style="margin: 0">{{ data?.total ?? '…' }} agents registered</p>
      <p class="soft" style="margin: 4px 0 0">Newest first. Scores are the registry's own average.</p>
    </div>
  </aside>
</template>
