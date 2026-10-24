<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const hover = ref<string>()

// Golden-angle spiral, newest at the centre. Size = reviews, colour = average (cold → warm).
const S = 600
const stars = computed(() => {
  const list = data.value?.items ?? []
  const max = Math.max(1, ...list.map((a) => scores.value?.get(a.tokenId)?.count ?? 0))
  return list.map((a, i) => {
    const angle = i * 2.39996
    const r = 26 * Math.sqrt(i + 0.6)
    const s = scores.value?.get(a.tokenId)
    const hue = s?.count ? 220 - (s.average / 100) * 180 : 230
    return {
      a,
      id: String(a.tokenId),
      x: S / 2 + r * Math.cos(angle) * 1.9,
      y: S / 2 + r * Math.sin(angle) * 1.9,
      size: 3 + 14 * Math.sqrt((s?.count ?? 0) / max),
      color: s?.count ? `hsl(${hue} 95% 65%)` : '#3a4170',
      s,
    }
  })
})
</script>

<template>
  <h1 class="o-title">Star field · {{ chain.name }}</h1>
  <p class="o-sub">{{ data?.total ?? '…' }} agents registered. Page {{ page + 1 }}, newest at the core. Bigger = more reviews, warmer = higher average, grey = unrated.</p>
  <form style="display: flex; gap: 8px; margin-bottom: 10px; max-width: 420px" @submit.prevent="setSearch(input)">
    <input v-model="input" type="search" placeholder="Find a star — name or token ID" aria-label="Search agents" style="flex: 1" />
    <button type="submit">Find</button>
  </form>
  <p v-if="searchIgnored" class="o-notice">{{ chain.name }} is read over RPC: search by token ID only.</p>
  <p v-if="error" class="o-notice">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="soft">Charting…</p>
  <p v-else-if="!data.items.length" class="soft">{{ search ? `No star matches “${search}”.` : 'An empty sky.' }}</p>
  <div v-else class="o-stage">
    <svg class="o-sky" :viewBox="`0 0 ${S} ${S}`" role="img" aria-label="Agents as stars">
      <g v-for="st in stars" :key="st.id" class="node" :class="{ dim: hover && hover !== st.id }" tabindex="0" @mouseenter="hover = st.id" @mouseleave="hover = undefined" @click="$router.push(to.agent(st.a.tokenId))">
        <title>{{ files.get(st.a.tokenId)?.name ?? `#${st.a.tokenId}` }} · {{ st.s?.count ?? 0 }} reviews</title>
        <circle :cx="st.x" :cy="st.y" :r="st.size * 2.2" :fill="st.color" fill-opacity=".12" />
        <circle :cx="st.x" :cy="st.y" :r="st.size" :fill="st.color" />
        <text v-if="st.size > 8 || hover === st.id" :x="st.x" :y="st.y + st.size + 12" text-anchor="middle">{{ (files.get(st.a.tokenId)?.name ?? `#${st.a.tokenId}`).slice(0, 18) }}</text>
      </g>
    </svg>
    <aside class="o-panel">
      <h3>Catalogue</h3>
      <ul class="o-list" style="max-height: 70vh">
        <li v-for="st in stars" :key="st.id" :class="{ on: hover === st.id }" @mouseenter="hover = st.id" @mouseleave="hover = undefined">
          <RouterLink :to="to.agent(st.a.tokenId)"><i :style="{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: st.color, marginRight: '6px' }" />{{ files.get(st.a.tokenId)?.name ?? `Agent #${st.a.tokenId}` }}</RouterLink>
          <span class="soft">{{ st.s?.count ? `${formatScore(st.s.average)} · ${st.s.count}` : scores ? '—' : '…' }}</span>
          <RouterLink v-if="st.a.owner" :to="to.owner(st.a.owner)" class="mono soft" :title="st.a.owner">{{ shortAddress(st.a.owner).slice(0, 6) }}</RouterLink>
        </li>
      </ul>
      <p v-if="page > 0 || data.hasMore" style="display: flex; justify-content: space-between; margin: 10px 0 0">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink>
      </p>
    </aside>
  </div>
</template>
