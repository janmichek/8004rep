<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { findChainBySlug } from '../chains'
import AgentRow from '../components/AgentRow.vue'
import Hint from '../components/ui/Hint.vue'
import Spinner from '../components/ui/Spinner.vue'
import { sourceFor } from '../data'
import { getScores } from '../data/rpc'
import type { AgentSummary, DataSource, ReputationSummary } from '../data/types'
import { useAsync } from '../useAsync'

const PAGE_SIZE = 25
/** Agents kept at the top of the first page, in this order. */
const PINNED = [184n, 279n, 204n, 281n, 214n]

const props = defineProps<{ slug: string }>()
const route = useRoute()
const router = useRouter()

// App.vue only renders this page for a known slug.
const chain = computed(() => findChainBySlug(props.slug)!)
/** Zero-based; the URL shows it one-based. */
const page = computed(() => Math.max(0, Math.trunc(Number(route.query.page) || 1) - 1))
const search = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))

async function pinnedItems(source: DataSource): Promise<AgentSummary[]> {
  const results = await Promise.allSettled(
    PINNED.map((tokenId) => source.listAgents({ page: 0, pageSize: 1, search: String(tokenId) })),
  )
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value.items : []))
}

const { data, error, loading, reload } = useAsync(
  async () => {
    const { source } = await sourceFor(chain.value)
    const result = await source.listAgents({ page: page.value, pageSize: PAGE_SIZE, search: search.value })
    if (page.value > 0 || search.value) return { ...result, textSearch: source.supportsTextSearch }
    const pinned = await pinnedItems(source)
    const pinnedIds = new Set(pinned.map((agent) => agent.tokenId))
    return {
      ...result,
      items: [...pinned, ...result.items.filter((agent) => !pinnedIds.has(agent.tokenId))],
      textSearch: source.supportsTextSearch,
    }
  },
  () => [chain.value, page.value, search.value],
)

const input = ref('')
watch(search, (value) => (input.value = value), { immediate: true })

// Scores come from the contracts after the list is on screen, so a slow or
// failed read never blocks or blanks the agents themselves.
const scores = shallowRef<Map<bigint, ReputationSummary>>()
let scoreRun = 0
watch(data, async (list) => {
  const run = ++scoreRun
  scores.value = undefined
  const items = list?.items
  if (!items?.length) return
  try {
    const { rpcClient } = await sourceFor(chain.value)
    const result = await getScores(
      rpcClient,
      chain.value,
      items.map((agent) => agent.tokenId),
    )
    if (run === scoreRun) scores.value = result
  } catch {
    if (run === scoreRun) scores.value = new Map()
  }
})

function submit(): void {
  const q = input.value.trim()
  void router.push({ query: q ? { q } : {} })
}

function pageLink(target: number) {
  return { query: { ...(search.value ? { q: search.value } : {}), ...(target > 0 ? { page: target + 1 } : {}) } }
}

/** A name was typed on a chain that can only look up token IDs. */
const searchIgnored = computed(() => Boolean(search.value) && !/^\d+$/.test(search.value) && data.value?.textSearch === false)
</script>

<template>
  <div class="page-head">
    <h1>
      Agents
      <small>
        {{ chain.name }}
        <template v-if="loading || !data"> · <Spinner label="Loading count" /></template>
        <template v-else-if="data.total !== undefined"> · {{ data.total }} registered</template>
      </small>
    </h1>
    <form class="search" role="search" @submit.prevent="submit">
      <input v-model="input" type="search" placeholder="Search by name or token ID" aria-label="Search agents" />
      <button type="submit">Search</button>
    </form>
  </div>

  <p v-if="searchIgnored" class="notice">
    Name search needs an indexed network — {{ chain.name }} is read straight from the contracts, so only token IDs can be
    looked up. Showing all agents.
  </p>

  <section v-if="error" class="state">
    <p>Could not load agents: {{ error }}</p>
    <button @click="reload">Retry</button>
  </section>
  <div v-else-if="loading || !data" class="loader"><Spinner large label="Loading agents" /></div>
  <section v-else-if="data.items.length === 0" class="state muted">
    {{ search ? `No agent matches “${search}”.` : 'No agents registered on this network yet.' }}
  </section>
  <template v-else>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th class="num">ID</th>
            <th>Owner</th>
            <Hint text="Count and average of all feedback values, any tag"><th class="num">Feedback</th></Hint>
            <th class="num">Created</th>
          </tr>
        </thead>
        <tbody>
          <AgentRow
            v-for="agent in data.items"
            :key="`${agent.chainId}:${agent.tokenId}`"
            :agent="agent"
            :chain="chain"
            :score="scores?.get(agent.tokenId)"
            :score-loading="scores === undefined"
          />
        </tbody>
      </table>
    </div>
    <nav v-if="page > 0 || data.hasMore" class="pager" aria-label="Pagination">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink>
      <span v-else class="muted">← Newer</span>
      <span>Page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink>
      <span v-else class="muted">Older →</span>
    </nav>
  </template>
</template>
