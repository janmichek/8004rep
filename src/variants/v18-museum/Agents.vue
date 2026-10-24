<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatScore, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { accessionOf, dimensionsOf, mediumOf, roomOf } from './museum'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const works = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    const s = scores.value?.get(a.tokenId)
    return { a, f, s, ...{ acc: accessionOf(a.tokenId), room: roomOf(s?.average) } }
  }),
)
</script>

<template>
  <p class="m-kicker">Galleries · {{ chain.name }}</p>
  <h1 class="m-h1">The collection on display</h1>
  <p class="m-lede">
    {{ data?.total ?? '—' }} works are hung in this wing. Each frame carries a wall label; the artist is the wallet that
    holds the work, and the dimensions record how many ratings stand behind it.
  </p>

  <form class="m-search" @submit.prevent="setSearch(input)">
    <span>Search the catalogue</span>
    <input v-model="input" type="search" placeholder="title, medium or accession number" aria-label="Search agents" />
    <button type="submit">Search</button>
  </form>
  <p v-if="searchIgnored" class="m-empty">This wing is read over RPC; only accession numbers can be searched.</p>
  <p v-if="error" class="m-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="m-empty">Unwrapping the works…</p>
  <p v-else-if="!data.items.length" class="m-empty">{{ search ? `No work matches “${search}”.` : 'The walls are bare.' }}</p>
  <template v-else>
    <ul class="m-wall">
      <li v-for="w in works" :key="w.a.tokenId.toString()" class="m-work">
        <RouterLink :to="to.agent(w.a.tokenId)" class="m-frame" :class="`room-${w.room.id === 'I' ? 1 : 0}`" :aria-label="w.f?.name ?? `Agent ${w.a.tokenId}`">
          <Sigil
            :seed="w.a.tokenId.toString()"
            :image="w.f?.image"
            :size="210"
            :palette="['#9a7a3f', '#4c6349', '#9c3b32', '#22211e', '#7d786e']"
          />
        </RouterLink>
        <div class="m-label">
          <div class="acc">{{ w.acc }} · {{ w.room.id === 'VI' ? 'not hung' : `Room ${w.room.id}` }}</div>
          <div class="title"><RouterLink :to="to.agent(w.a.tokenId)">{{ w.f?.name ?? `Untitled (Agent ${w.a.tokenId})` }}</RouterLink></div>
          <div class="artist">Held by <RouterLink v-if="w.a.owner" :to="to.owner(w.a.owner)">{{ shortAddress(w.a.owner) }}</RouterLink><span v-else>an unknown hand</span></div>
          <div class="meta">
            {{ mediumOf(w.f?.services) }}<br />
            {{ dimensionsOf(w.s?.count, w.s?.average) }}<br />
            <template v-if="w.s?.count">Mean {{ formatScore(w.s.average) }} / 100</template><template v-else>Not yet rated</template>
          </div>
        </div>
      </li>
    </ul>

    <nav v-if="page > 0 || data.hasMore" class="m-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Previous wall</RouterLink><span v-else />
      <span>Wall {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Next wall →</RouterLink><span v-else />
    </nav>
  </template>
</template>
