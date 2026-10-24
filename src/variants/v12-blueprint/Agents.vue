<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDate, formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

function tol(average: number | undefined): { g: string; tone: string } {
  if (average === undefined) return { g: '—', tone: '' }
  if (average >= 85) return { g: 'A', tone: 'ok' }
  if (average >= 70) return { g: 'B', tone: 'ok' }
  if (average >= 55) return { g: 'C', tone: 'warn' }
  if (average >= 40) return { g: 'D', tone: 'warn' }
  return { g: 'F', tone: 'bad' }
}
const rows = computed(() =>
  (data.value?.items ?? []).map((a, i) => {
    const s = scores.value?.get(a.tokenId)
    const f = files.value.get(a.tokenId)
    return { a, f, s, item: page.value * 25 + i + 1, tol: tol(s?.average) }
  }),
)
const rated = computed(() => rows.value.filter((r) => r.s?.count))
const cert = computed(() => (rated.value.length ? rated.value.filter((r) => (r.s?.average ?? 0) >= 70).length / rated.value.length : null))
const mean = computed(() => (rated.value.length ? rated.value.reduce((n, r) => n + (r.s?.average ?? 0), 0) / rated.value.length : null))
const services = computed(() => (data.value?.items ?? []).reduce((n, a) => n + (files.value.get(a.tokenId)?.services.length ?? 0), 0))
</script>

<template>
  <p class="bp-kicker">Sheet 01 / parts schedule / {{ chain.name }}</p>
  <div class="bp-title">
    <div>
      <h1 class="bp-h1">Registered assemblies</h1>
      <p class="bp-prose">
        Bill of materials for every agent on the registry, newest first. PART NO is the token id; RATING is the mean of
        all certificates on file; TOL is that mean banded. Dimensions are not to scale.
      </p>
    </div>
    <div class="bp-panel">
      <h3>Schedule totals</h3>
      <div class="bp-kv"><span>Assemblies on record</span><b>{{ data?.total ?? '—' }}</b></div>
      <div class="bp-kv"><span>Rated on this sheet</span><b>{{ rated.length }}/{{ rows.length }}</b></div>
      <div class="bp-kv"><span>Mean rating</span><b>{{ formatNumber(mean) }}</b></div>
      <div class="bp-kv"><span>Above tolerance (≥70)</span><b>{{ cert === null ? '—' : `${Math.round(cert * 100)}%` }}</b></div>
      <div class="bp-kv"><span>Declared services</span><b>{{ services }}</b></div>
    </div>
  </div>

  <form class="bp-search" @submit.prevent="setSearch(input)">
    <span>QUERY</span>
    <input v-model="input" type="search" placeholder="part number or assembly name" aria-label="Search agents" />
    <button type="submit">FILTER</button>
  </form>
  <p v-if="searchIgnored" class="bp-note">RPC site: only part numbers (token ids) can be queried.</p>
  <p v-if="error" class="bp-err">{{ error }} <button @click="reload">RETRY</button></p>
  <p v-else-if="loading || !data" class="bp-empty">Reading the schedule…</p>
  <p v-else-if="!data.items.length" class="bp-empty">{{ search ? `No parts match “${search}”.` : 'No assemblies registered.' }}</p>
  <div v-else class="tb-wrap">
    <table class="bp-table">
      <thead>
        <tr><th>Item</th><th>Part no.</th><th>Description</th><th>Supplier</th><th class="num">Qty</th><th class="num">Rating</th><th class="num">Tol</th><th class="num">Dated</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.a.tokenId.toString()">
          <td class="dim">{{ String(r.item).padStart(3, '0') }}</td>
          <td class="part"><RouterLink :to="to.agent(r.a.tokenId)">{{ r.a.tokenId }}</RouterLink></td>
          <td>
            <RouterLink :to="to.agent(r.a.tokenId)">{{ r.f?.name ?? `Agent ${r.a.tokenId}` }}</RouterLink>
            <span v-if="r.f?.services.length" class="dim"> · {{ r.f.services.map((s) => s.name).join(' / ') }}</span>
          </td>
          <td class="bp-mono"><RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)">{{ shortAddress(r.a.owner) }}</RouterLink><span v-else class="dim">—</span></td>
          <td class="num">{{ r.s ? `${r.s.capped ? '≥' : ''}${r.s.count}` : '—' }}</td>
          <td class="num"><b>{{ r.s?.count ? formatScore(r.s.average) : '—' }}</b></td>
          <td class="num"><span class="bp-grade" :class="r.tol.tone">{{ r.tol.g }}</span></td>
          <td class="num dim">{{ r.a.createdAt ? formatDate(r.a.createdAt) : '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <nav v-if="page > 0 || data?.hasMore" class="bp-pager">
    <RouterLink v-if="page > 0" :to="{ name: 'agents', params: { slug }, ...pageLink(page - 1) }">← PREVIOUS SHEET</RouterLink><span v-else />
    <span class="soft">SHEET {{ page + 1 }}</span>
    <RouterLink v-if="data?.hasMore" :to="{ name: 'agents', params: { slug }, ...pageLink(page + 1) }">NEXT SHEET →</RouterLink><span v-else />
  </nav>
</template>
