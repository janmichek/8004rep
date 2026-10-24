<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { abundance, taxonOf } from './taxonomy'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

function determination(average: number | undefined): { g: string; tone: string } {
  if (average === undefined) return { g: 'n.d.', tone: '' }
  if (average >= 85) return { g: 'A', tone: '' }
  if (average >= 70) return { g: 'B', tone: '' }
  if (average >= 55) return { g: 'C', tone: 'warn' }
  if (average >= 40) return { g: 'D', tone: 'warn' }
  return { g: 'F', tone: 'bad' }
}
const cards = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    const s = scores.value?.get(a.tokenId)
    return { a, f, s, taxon: taxonOf(f, `Agent ${a.tokenId}`), det: determination(s?.average), ab: abundance(s?.count) }
  }),
)
</script>

<template>
  <p class="h-kicker">Field guide · {{ chain.name }}</p>
  <h1 class="h-h1">Specimens of the {{ chain.name }} flora</h1>
  <p class="h-lede">
    {{ data?.total ?? '—' }} specimens are pressed in this region. Each label carries the collector, the declared
    habitat and a provisional determination; the full sheet holds the observations.
  </p>

  <form class="h-search" @submit.prevent="setSearch(input)">
    <span>Find a specimen</span>
    <input v-model="input" type="search" placeholder="name, epithet or collection number" aria-label="Search agents" />
    <button type="submit">Search</button>
  </form>

  <p v-if="searchIgnored" class="h-empty">RPC region: only collection numbers can be searched.</p>
  <p v-if="error" class="h-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="h-empty">Opening the cabinet…</p>
  <p v-else-if="!data.items.length" class="h-empty">{{ search ? `No specimen matches “${search}”.` : 'The cabinet is empty.' }}</p>
  <template v-else>
    <ul class="h-grid">
      <li v-for="c in cards" :key="c.a.tokenId.toString()" class="h-card">
        <span class="h-pin" />
        <div class="h-specimen">
          <Sigil :seed="`${c.a.chainId}:${c.a.tokenId}`" :image="c.f?.image" :size="54" :palette="['#3f5d3a', '#7d8a4e', '#9a5b3f', '#b28b3c', '#2c4229']" />
          <div class="h-name">
            <RouterLink :to="to.agent(c.a.tokenId)">{{ c.f?.name ?? `Agent ${c.a.tokenId}` }}</RouterLink>
            <span class="h-taxon">{{ c.taxon.line }}</span>
          </div>
        </div>
        <p class="h-desc">{{ c.f?.description ?? (c.f === null ? 'Registration file unreachable; label reconstructed from the chain.' : 'No description on the sheet.') }}</p>
        <dl class="h-label">
          <dt>Collection</dt><dd class="h-mono">#{{ c.a.tokenId }}</dd>
          <dt>Collector</dt><dd><RouterLink v-if="c.a.owner" :to="to.owner(c.a.owner)">{{ shortAddress(c.a.owner) }}</RouterLink><span v-else>—</span></dd>
          <dt>Habitat</dt><dd>{{ c.f?.services.map((s) => s.name).join(', ') || 'undescribed' }}</dd>
          <dt>Observed</dt><dd>{{ c.s?.count ? `${c.s.count}× · ${c.ab.word}` : 'not observed' }}</dd>
          <dt>Determination</dt><dd class="h-det" :class="c.det.tone">{{ c.det.g }}<span v-if="c.s?.count" class="soft"> · {{ formatScore(c.s.average) }}</span></dd>
          <dt>Pressed</dt><dd>{{ c.a.createdAt ? formatDate(c.a.createdAt) : 'undated' }}</dd>
        </dl>
      </li>
    </ul>
    <nav v-if="page > 0 || data.hasMore" class="h-pager">
      <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← Earlier sheets</RouterLink><span v-else />
      <span class="soft">cabinet {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">Later sheets →</RouterLink><span v-else />
    </nav>
  </template>
</template>
