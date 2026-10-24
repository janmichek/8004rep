<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { GRADES, provisionalGrade } from './grade'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })
const dist = computed(() => {
  if (!scores.value) return undefined
  const n = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<string, number>
  for (const a of data.value?.items ?? []) n[provisionalGrade(scores.value.get(a.tokenId))]++
  return n
})
</script>

<template>
  <section class="u-sec">
    <h2><span>§0</span> Subject index · {{ chain.name }}</h2>
    <form style="display: flex; gap: 8px; margin-bottom: 10px" @submit.prevent="setSearch(input)">
      <input v-model="input" type="search" placeholder="Subject name or token ID" aria-label="Search agents" style="flex: 1; max-width: 360px" />
      <button type="submit">Pull file</button>
    </form>
    <div class="u-fields">
      <div class="u-field"><label>Subjects on record</label><div>{{ data?.total ?? '—' }}</div></div>
      <div class="u-field"><label>Page</label><div>{{ page + 1 }}</div></div>
      <div v-if="dist" class="u-field" style="grid-column: span 2"><label>Provisional grades on this page</label><div><template v-for="g in GRADES" :key="g"><span :class="`u-g-${g}`">{{ g }}</span>:{{ dist[g] }}&nbsp; </template></div></div>
    </div>
    <p class="soft" style="font-size: 12px">Provisional grade: on-chain average banded, evidence by review count. The subject file applies every rule.</p>
    <p v-if="searchIgnored" class="u-notice">{{ chain.name }} records are read from the contracts: token IDs only. Showing the full index.</p>
    <p v-if="error" class="u-notice">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="soft mono">Retrieving records…</p>
    <p v-else-if="!data.items.length" class="soft mono">{{ search ? `No subject matches “${search}”.` : 'No subjects on record.' }}</p>
    <template v-else>
      <div class="u-scroll">
        <table class="u-table">
          <thead><tr><th>Grade</th><th>Subject</th><th class="num">ID</th><th>Guarantor</th><th class="num">Reports</th><th class="num">Avg</th><th>Opened</th></tr></thead>
          <tbody>
            <tr v-for="a in data.items" :key="a.tokenId.toString()">
              <td><b :class="`u-g-${provisionalGrade(scores?.get(a.tokenId))}`" style="font-size: 16px">{{ scores ? provisionalGrade(scores.get(a.tokenId)) : '…' }}</b></td>
              <td><RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `AGENT ${a.tokenId}` }}</RouterLink></td>
              <td class="num">{{ a.tokenId }}</td>
              <td><RouterLink v-if="a.owner" :to="to.owner(a.owner)">{{ shortAddress(a.owner) }}</RouterLink></td>
              <td class="num">{{ scores?.get(a.tokenId)?.count ?? '…' }}</td>
              <td class="num">{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</td>
              <td>{{ a.createdAt ? formatDate(a.createdAt) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="page > 0 || data.hasMore" style="display: flex; gap: 8px">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)"><button>← Newer</button></RouterLink>
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)"><button>Older →</button></RouterLink>
      </p>
    </template>
  </section>
</template>
