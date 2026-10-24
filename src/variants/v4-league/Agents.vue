<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatNumber, formatScore, shortAddress } from '../../format'
import { rankScore } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import { routes, useAgentList, useChain, useEcosystem, useFiles, usePageQuery } from '../shared/use'
import { tierOf } from './league'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const ecosystem = useEcosystem()
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

type Sort = 'pts' | 'avg' | 'played' | 'newest'
const sort = ref<Sort>('pts')
const prior = computed(() => ecosystem.data.value?.averageFeedback ?? 50)
const table = computed(() => {
  const rows = (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    const pts = rankScore(s, prior.value)
    return { a, s, pts, tier: tierOf(pts, s?.count ?? 0) }
  })
  const key: Record<Sort, (r: (typeof rows)[number]) => number> = {
    pts: (r) => r.pts ?? -1,
    avg: (r) => (r.s?.count ? r.s.average : -1),
    played: (r) => r.s?.count ?? -1,
    newest: (r) => Number(r.a.tokenId),
  }
  return [...rows].sort((x, y) => key[sort.value](y) - key[sort.value](x))
})
const ranked = computed(() => table.value.filter((r) => r.pts !== null).length)
</script>

<template>
  <div class="g-two" style="align-items: end">
    <h1 class="g-title"><small>{{ chain.name }} · matchday {{ page + 1 }}</small>Standings</h1>
    <form style="display: flex; gap: 6px; justify-content: flex-end" @submit.prevent="setSearch(input)">
      <input v-model="input" type="search" placeholder="Find a player — name or #" aria-label="Search agents" style="flex: 1; max-width: 300px" />
      <button type="submit">Scout</button>
    </form>
  </div>
  <p class="soft">
    Points = on-chain average pulled toward the league mean ({{ formatNumber(prior) }}) by 5 phantom reviews, so a 2-review 100 can't top the table.
    <template v-if="data?.total !== undefined">{{ data.total }} registered · {{ ranked }} ranked on this page.</template>
  </p>
  <p v-if="searchIgnored" class="g-notice">{{ chain.name }} is read over RPC — scout by token # only. Showing everyone.</p>
  <p v-if="error" class="g-notice">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="soft">Warming up…</p>
  <p v-else-if="!data.items.length" class="soft">{{ search ? `No player matches “${search}”.` : 'No players registered yet.' }}</p>
  <div v-else class="g-scroll">
    <table class="g-table">
      <thead>
        <tr>
          <th>Pos</th><th>Player</th><th>Tier</th>
          <th class="num"><button :class="{ on: sort === 'played' }" @click="sort = 'played'">Played</button></th>
          <th class="num"><button :class="{ on: sort === 'avg' }" @click="sort = 'avg'">Avg</button></th>
          <th class="num"><button :class="{ on: sort === 'pts' }" @click="sort = 'pts'">Pts</button></th>
          <th><button :class="{ on: sort === 'newest' }" @click="sort = 'newest'">Club</button></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in table" :key="r.a.tokenId.toString()" :class="{ 'g-zone-up': sort === 'pts' && i < 3 && r.pts !== null, 'g-zone-down': sort === 'pts' && r.pts !== null && i >= ranked - 3 && ranked > 6 }">
          <td class="g-pos" :class="sort === 'pts' && r.pts !== null ? `p${i + 1}` : ''">{{ r.pts === null && sort === 'pts' ? '–' : i + 1 }}</td>
          <td>
            <RouterLink :to="to.agent(r.a.tokenId)" style="display: inline-flex; gap: 10px; align-items: center">
              <Sigil :seed="`${r.a.chainId}:${r.a.tokenId}`" :image="files.get(r.a.tokenId)?.image" :size="30" round :palette="['#d7ff3a', '#2fd27a', '#4a63d9', '#ff4f6d', '#111c45']" />
              <b>{{ files.get(r.a.tokenId)?.name ?? `Agent #${r.a.tokenId}` }}</b>
              <span class="soft">#{{ r.a.tokenId }}</span>
            </RouterLink>
          </td>
          <td><span class="g-tier" :class="r.tier">{{ r.tier }}</span></td>
          <td class="num">{{ r.s ? r.s.count : scores ? '?' : '…' }}</td>
          <td class="num">{{ r.s?.count ? formatScore(r.s.average) : '–' }}</td>
          <td class="num g-pts">{{ formatNumber(r.pts) }}</td>
          <td><RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)" class="mono soft">{{ shortAddress(r.a.owner) }}</RouterLink></td>
        </tr>
      </tbody>
    </table>
    <p v-if="page > 0 || data.hasMore" style="display: flex; gap: 10px; justify-content: center">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
    </p>
  </div>
</template>
