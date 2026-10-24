<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
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
  <p class="l-kicker">The Register · {{ chain.name }}</p>
  <h2 class="l-head">Agents, newest first</h2>
  <p class="l-deck">
    Every agent minted in the identity registry, listed as it appears on chain<template v-if="data?.total !== undefined"> — {{ data.total }} on record</template>.
  </p>
  <form class="l-byline" style="display: flex; gap: 10px; align-items: center" @submit.prevent="setSearch(input)">
    <label for="l-q">Look up</label>
    <input id="l-q" v-model="input" type="search" placeholder="a name or token number" style="flex: 1; max-width: 320px" />
    <button type="submit">Search</button>
  </form>
  <p v-if="searchIgnored" class="l-notice">{{ chain.name }} is read straight from the contracts; only token numbers can be looked up. The full register follows.</p>
  <p v-if="error" class="l-notice">The register could not be read: {{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="l-deck">Setting type…</p>
  <p v-else-if="!data.items.length" class="l-deck">{{ search ? `No entry matches “${search}”.` : 'No agents registered yet.' }}</p>
  <template v-else>
    <div class="l-classified">
      <article v-for="a in data.items" :key="a.tokenId.toString()">
        <h4><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `Agent No. ${a.tokenId}` }}</RouterLink></h4>
        <p class="muted" style="font-size: 12px">No. {{ a.tokenId }}<template v-if="a.createdAt"> · reg. {{ formatDate(a.createdAt) }}</template></p>
        <p v-if="files.get(a.tokenId)?.description" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden">{{ files.get(a.tokenId)!.description }}</p>
        <p style="font-size: 13px">
          <template v-if="scores?.get(a.tokenId)?.count">Rated <b>{{ formatScore(scores.get(a.tokenId)!.average) }}</b> by {{ scores.get(a.tokenId)!.count }}.</template>
          <span v-else-if="scores" class="muted">Not yet reviewed.</span>
          <span v-else class="muted">Ratings pending…</span>
          <template v-if="a.owner"> Owner <RouterLink :to="to.owner(a.owner)" class="l-mono">{{ shortAddress(a.owner) }}</RouterLink>.</template>
        </p>
      </article>
    </div>
    <nav v-if="page > 0 || data.hasMore" class="l-pager">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer entries</RouterLink><span v-else />
      <span>Page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older entries →</RouterLink><span v-else />
    </nav>
  </template>
</template>
