<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { addressExplorerUrl } from '../../chains'
import { formatNumber, formatScore } from '../../format'
import { asciiBar, effectiveCount } from '../shared/metrics'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import Prompt from './Prompt.vue'
import { useRowCursor } from './useRows'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const router = useRouter()
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)

const rows = computed(() => (data.value?.items ?? []).map((a) => ({ a, s: scores.value?.get(a.tokenId), f: files.value.get(a.tokenId) })))
// Count-weighted: every review counts once, unlike the classic mean of means.
const portfolio = computed(() => {
  if (!scores.value) return undefined
  const rated = rows.value.filter((r) => r.s && r.s.count > 0)
  const reviews = rated.reduce((a, r) => a + r.s!.count, 0)
  return {
    rated: rated.length,
    reviews,
    weighted: reviews ? rated.reduce((a, r) => a + r.s!.count * r.s!.average, 0) / reviews : null,
    effective: effectiveCount(rated.map((r) => r.s!.count)),
  }
})
const max = computed(() => Math.max(1, ...rows.value.map((r) => r.s?.count ?? 0)))
const cursor = useRowCursor(
  () => rows.value.length,
  (i) => void router.push(to.agent(rows.value[i].a.tokenId)),
)
</script>

<template>
  <pre v-if="!address" class="t-err">error: "{{ props.address }}" is not a 0x address</pre>
  <Prompt v-else :cmd="`whois ${address}`" :busy="loading">
    <dl class="t-kv">
      <dt>address</dt><dd><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ address }} ↗</a></dd>
      <dt>owns</dt><dd>{{ data?.total ?? '…' }} agents on {{ chain.name }}</dd>
      <template v-if="portfolio">
        <dt>rated</dt><dd>{{ portfolio.rated }} of {{ rows.length }} on this page</dd>
        <dt>review-weighted avg</dt><dd class="hi">{{ formatNumber(portfolio.weighted) }} <span class="dim">over {{ portfolio.reviews }} reviews</span></dd>
        <dt title="1 / Σ share² of reviews">effective agents</dt><dd>{{ formatNumber(portfolio.effective) }} <span class="dim">(how many agents the reviews really spread over)</span></dd>
      </template>
    </dl>
  </Prompt>
  <Prompt v-if="address" :cmd="`ls agents --owner=${address.slice(0, 8)}…`" :busy="loading">
    <pre v-if="error" class="t-err">error: {{ error }}</pre>
    <pre v-else-if="!data" class="dim">reading…</pre>
    <pre v-else-if="!data.items.length" class="dim">{{ page > 0 ? 'no more agents' : 'owns no agents here' }}</pre>
    <table v-else class="t-table">
      <thead><tr><th class="num">id</th><th class="num">n</th><th class="num">avg</th><th>reviews</th><th>name</th></tr></thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.a.tokenId.toString()" :class="{ sel: i === cursor }" @mouseenter="cursor = i">
          <td class="num">{{ r.a.tokenId }}</td>
          <td class="num">{{ r.s?.count ?? (scores ? '?' : '…') }}</td>
          <td class="num">{{ r.s?.count ? formatScore(r.s.average) : '-' }}</td>
          <td class="dim">{{ asciiBar((r.s?.count ?? 0) / max, 16) }}</td>
          <td><RouterLink :to="to.agent(r.a.tokenId)">{{ r.f?.name ?? `agent-${r.a.tokenId}` }}</RouterLink></td>
        </tr>
      </tbody>
    </table>
    <p v-if="data && (page > 0 || data.hasMore)">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)">[&lt; newer]</RouterLink>
      <span class="dim"> page {{ page + 1 }} </span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">[older &gt;]</RouterLink>
    </p>
  </Prompt>
</template>
