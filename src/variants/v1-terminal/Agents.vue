<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatDate, formatNumber, formatScore, shortAddress } from '../../format'
import { asciiBar, rankScore } from '../shared/metrics'
import { routes, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { useEcosystem } from '../shared/use'
import Prompt from './Prompt.vue'
import { useRowCursor } from './useRows'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const router = useRouter()
const { page, search, pageLink, setSearch } = usePageQuery()
const { data, error, loading, reload, scores, searchIgnored } = useAgentList(chain, page, search)
const files = useFiles(() => data.value?.items)
const ecosystem = useEcosystem()

const input = ref('')
watch(search, (v) => (input.value = v), { immediate: true })

// Rank = on-chain average shrunk toward the ecosystem mean (or 50 without it).
const prior = computed(() => ecosystem.data.value?.averageFeedback ?? 50)
const rows = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    const f = files.value.get(a.tokenId)
    return {
      a,
      f,
      s,
      rank: rankScore(s, prior.value),
      flags: `${f?.active ? 'a' : '-'}${f?.x402Support ? 'x' : '-'}${f?.services?.length ? 's' : '-'}${f === null ? '!' : '-'}`,
    }
  }),
)
const rated = computed(() => rows.value.filter((r) => r.s && r.s.count > 0))
const cursor = useRowCursor(
  () => rows.value.length,
  (i) => void router.push(to.agent(rows.value[i].a.tokenId)),
)
const cmd = computed(() => `ls -l agents/${chain.value.slug}${search.value ? ` | grep "${search.value}"` : ''} --page=${page.value + 1}`)
</script>

<template>
  <form @submit.prevent="setSearch(input)" style="display: flex; gap: 8px; align-items: center">
    <span class="dim">grep:</span>
    <input v-model="input" data-search type="search" placeholder="name or token id" aria-label="Search agents" style="width: 28ch" />
    <button type="submit">run</button>
  </form>
  <Prompt :cmd="cmd" :busy="loading">
    <pre v-if="searchIgnored" class="amber">warn: {{ chain.name }} is read over RPC; only token IDs can be searched. listing all.</pre>
    <pre v-if="error" class="t-err">error: {{ error }} <button @click="reload">retry</button></pre>
    <pre v-else-if="loading || !data" class="dim">reading registry…</pre>
    <pre v-else-if="!data.items.length" class="dim">{{ search ? `no match for "${search}"` : '0 agents' }}</pre>
    <template v-else>
      <pre class="dim">total {{ data.total ?? '?' }} · rated on page {{ scores ? `${rated.length}/${rows.length}` : '…' }} · flags: a=active x=x402 s=services !=file unreachable</pre>
      <div class="t-scroll">
        <table class="t-table">
          <thead>
            <tr>
              <th>flags</th><th class="num">id</th><th>owner</th><th class="num">n</th><th class="num">avg</th>
              <th class="num" title="On-chain average shrunk toward the ecosystem mean by 5 phantom reviews">rank</th><th></th><th>created</th><th>name</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="r.a.tokenId.toString()" :class="{ sel: i === cursor }" @mouseenter="cursor = i">
              <td class="dim">{{ r.flags }}</td>
              <td class="num">{{ r.a.tokenId }}</td>
              <td>
                <RouterLink v-if="r.a.owner" :to="to.owner(r.a.owner)">{{ shortAddress(r.a.owner) }}</RouterLink>
                <span v-else class="dim">-</span>
              </td>
              <td class="num">{{ r.s ? `${r.s.capped ? '≥' : ''}${r.s.count}` : scores ? '?' : '…' }}</td>
              <td class="num">{{ r.s?.count ? formatScore(r.s.average) : '-' }}</td>
              <td class="num hi">{{ formatNumber(r.rank) }}</td>
              <td class="dim">{{ r.rank === null ? '' : asciiBar(r.rank / 100, 12) }}</td>
              <td class="dim">{{ r.a.createdAt ? formatDate(r.a.createdAt) : '-' }}</td>
              <td>
                <RouterLink :to="to.agent(r.a.tokenId)" class="ellipsis">{{ r.f?.name ?? (r.f === undefined ? '…' : `agent-${r.a.tokenId}`) }}</RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="page > 0 || data.hasMore">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)">[&lt; newer]</RouterLink>
        <span class="dim"> page {{ page + 1 }} </span>
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">[older &gt;]</RouterLink>
      </p>
    </template>
  </Prompt>
</template>
