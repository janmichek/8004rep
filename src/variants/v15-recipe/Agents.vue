<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { confidenceOf, starsOf } from './taste'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

const recipes = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    const s = scores.value?.get(a.tokenId)
    return { a, f, s, stars: starsOf(s?.average), taste: confidenceOf(s?.count) }
  }),
)
</script>

<template>
  <p class="r-kicker">Recipe index · {{ chain.name }}</p>
  <h1 class="r-h1">What the kitchen is serving</h1>
  <p class="r-lede">
    {{ data?.total ?? '—' }} dishes are on the menu. Stars are the mean of every tasting on record; the note below
    each dish says how often it has actually been tasted.
  </p>

  <form class="r-search" @submit.prevent="setSearch(input)">
    <span>Find a dish</span>
    <input v-model="input" type="search" placeholder="name, ingredient or number" aria-label="Search agents" />
    <button type="submit">Search</button>
  </form>
  <p v-if="searchIgnored" class="r-empty">This pantry is read over RPC; only dish numbers can be searched.</p>
  <p v-if="error" class="r-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="r-empty">Opening the recipe box…</p>
  <p v-else-if="!data.items.length" class="r-empty">{{ search ? `Nothing on the menu matches “${search}”.` : 'The kitchen has no dishes.' }}</p>
  <template v-else>
    <ul class="r-grid">
      <li v-for="r in recipes" :key="r.a.tokenId.toString()" class="r-card">
        <div>
          <div class="r-dish"><RouterLink :to="to.agent(r.a.tokenId)">{{ r.f?.name ?? `Dish ${r.a.tokenId}` }}</RouterLink></div>
          <div class="r-sub">No. {{ r.a.tokenId }} · {{ r.f?.services.map((s) => s.name).join(' · ') || 'no ingredients declared' }}</div>
        </div>
        <div class="r-stars" :title="r.s?.count ? `${formatScore(r.s.average)} / 100` : 'not tasted'">
          <span v-for="(star, i) in r.stars" :key="i" :class="{ off: star === 'off' }">{{ star === 'off' ? '☆' : '★' }}</span>
          <span class="r-sub" style="margin-left: 6px">{{ r.s?.count ? formatScore(r.s.average) : '—' }}</span>
        </div>
        <p class="r-desc">{{ r.f?.description ?? 'The card came to us without a headnote.' }}</p>
        <ul class="r-ing">
          <li><span>Chef</span><span><RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)" class="r-mono">{{ shortAddress(r.a.owner) }}</RouterLink><span v-else>—</span></span></li>
          <li><span>Tastings</span><span>{{ r.s?.count ?? 0 }} · {{ r.taste.word }}</span></li>
          <li><span>Added</span><span>{{ r.a.createdAt ? formatDate(r.a.createdAt) : 'undated' }}</span></li>
        </ul>
      </li>
    </ul>
    <nav v-if="page > 0 || data.hasMore" class="r-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Earlier dishes</RouterLink><span v-else />
      <span class="soft">page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">More dishes →</RouterLink><span v-else />
    </nav>
  </template>
</template>
