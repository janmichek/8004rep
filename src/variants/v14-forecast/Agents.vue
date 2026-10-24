<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { conditionOf, confidenceOf } from './weather'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

const cards = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    return { a, f: files.value.get(a.tokenId), s, condition: conditionOf(s?.average), confidence: confidenceOf(s?.count) }
  }),
)
</script>

<template>
  <p class="f-kicker">Local forecast · {{ chain.name }}</p>
  <h1 class="f-h1">Conditions across {{ data?.total ?? '—' }} stations</h1>
  <p class="f-lede">
    Temperature is the mean of all readings on record. The glyph describes that mean; confidence says how much
    observation stands behind it, not how the reading was earned. Open a station for the full outlook.
  </p>

  <form class="f-search" @submit.prevent="setSearch(input)">
    <input v-model="input" type="search" placeholder="Find a station by name or number" aria-label="Search agents" />
    <button type="submit">Look up</button>
  </form>
  <p v-if="searchIgnored" class="f-empty">This station network reports over RPC; only station numbers can be looked up.</p>
  <p v-if="error" class="f-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="f-empty">Reading the instruments…</p>
  <p v-else-if="!data.items.length" class="f-empty">{{ search ? `No station matches “${search}”.` : 'No stations reporting.' }}</p>
  <template v-else>
    <ul class="f-forecast">
      <li v-for="c in cards" :key="c.a.tokenId.toString()" class="f-card" :class="{ 'f-warn-bg': c.condition.tone === 'bad' }">
        <div class="f-card-top">
          <span class="f-glyph" :title="c.condition.label">{{ c.condition.glyph }}</span>
          <div class="f-place">
            <RouterLink :to="to.agent(c.a.tokenId)">{{ c.f?.name ?? `Station ${c.a.tokenId}` }}</RouterLink>
            <span>#{{ c.a.tokenId }} · {{ c.condition.label }}</span>
          </div>
        </div>
        <div class="f-card-temp">{{ c.s?.count ? formatScore(c.s.average) : '—' }}<sup>°</sup></div>
        <div class="f-card-meta">
          <span>{{ c.confidence.word }} · {{ c.s?.count ?? 0 }} obs</span>
          <span>{{ c.a.createdAt ? formatDate(c.a.createdAt) : 'undated' }}</span>
        </div>
        <div class="f-card-meta" style="border-top: 0; padding-top: 0">
          <span><RouterLink v-if="c.a.owner" :to="to.owner(c.a.owner)" class="f-mono">{{ shortAddress(c.a.owner) }}</RouterLink><span v-else>no operator</span></span>
          <span>{{ c.f?.services.length ?? 0 }} instruments</span>
        </div>
      </li>
    </ul>
    <nav v-if="page > 0 || data.hasMore" class="f-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Previous observations</RouterLink><span v-else />
      <span class="soft">page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Next observations →</RouterLink><span v-else />
    </nav>
  </template>
</template>
