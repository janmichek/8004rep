<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePinnedAgents } from '../bookmarks'
import ScanAgentRow from '../components/ScanAgentRow.vue'
import ChainName from '../components/ChainName.vue'
import SelectMenu, { type SelectOption } from '../components/ui/SelectMenu.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { fetchScanAgents, fetchScanChains } from '../data/scan'
import { networkEnv } from '../env'
import { useAsync } from '../useAsync'

const PAGE_SIZE = 25
const RATED_SIZE = 50

// The list spans every network now; the slug in the path is kept for older links.
defineProps<{ slug: string }>()

const route = useRoute()
const router = useRouter()

/** Show the 50 agents with the most feedback, ignoring the page cursor. */
const rated = computed(() => route.query.rated === '1')

/** Zero-based; the URL shows it one-based. */
const page = computed(() => (rated.value ? 0 : Math.max(0, Math.trunc(Number(route.query.page) || 1) - 1)))
const search = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))

/** Server-side sort: only Registered has a fast path on 8004scan. */
type RegisteredOrder = 'asc' | 'desc'
const sort = computed(() => (route.query.sort === 'registered' ? 'registered' : null))
const order = computed<RegisteredOrder>(() => (route.query.order === 'asc' ? 'asc' : 'desc'))
const registeredSort = computed(() => (sort.value === 'registered' ? order.value : null))

const chainQuery = computed(() => {
  const raw = route.query.chain
  const value = typeof raw === 'string' ? Number(raw) : Number.NaN
  return Number.isInteger(value) ? value : undefined
})

const { data: chains } = useAsync(fetchScanChains, () => true)
const chainMap = computed(() => new Map((chains.value ?? []).map((chain) => [chain.chainId, chain])))
const envChains = computed(() => (chains.value ?? []).filter((chain) => chain.testnet === (networkEnv.value === 'testnet')))
const selectedChain = computed(() => envChains.value.find((chain) => chain.chainId === chainQuery.value))

const networkOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: 'All networks' },
  ...envChains.value.map((chain) => ({ value: String(chain.chainId), label: chain.name, chainId: chain.chainId })),
])
const networkValue = computed(() => (selectedChain.value ? String(selectedChain.value.chainId) : 'all'))

const { data, error, loading, reload } = useAsync(
  () =>
    fetchScanAgents({
      page: page.value,
      pageSize: rated.value ? RATED_SIZE : PAGE_SIZE,
      search: search.value || undefined,
      isTestnet: networkEnv.value === 'testnet',
      chainId: selectedChain.value?.chainId,
      sortBy: rated.value ? 'total_feedbacks' : sort.value === 'registered' ? 'created_at' : undefined,
      sortOrder: rated.value ? 'desc' : sort.value === 'registered' ? order.value : undefined,
    }),
  () => [page.value, rated.value, search.value, networkEnv.value, selectedChain.value, sort.value, order.value],
)

// Bookmarks: delete `src/bookmarks/` and replace with `data.items` / empty on `data.items.length === 0`.
const feedItems = computed(() => data.value?.items ?? [])
const selectedChainId = computed(() => selectedChain.value?.chainId)
const { pinned, feed, hasRows } = usePinnedAgents({ items: feedItems, chainId: selectedChainId, search })

const input = ref('')
watch(search, (value) => (input.value = value), { immediate: true })

// A network from the other environment cannot stay selected after the header switch moves.
watch([networkEnv, chains], () => {
  if (chainQuery.value !== undefined && chains.value && !selectedChain.value) pushQuery({ chain: null })
})

function pushQuery(next: {
  q?: string
  chain?: number | null
  page?: number
  sort?: 'registered' | null
  order?: RegisteredOrder
  rated?: boolean
}): void {
  const query: Record<string, string> = {}
  const q = next.q !== undefined ? next.q.trim() : search.value
  const chain = next.chain === undefined ? chainQuery.value : (next.chain ?? undefined)
  const target = next.page !== undefined ? next.page : 0
  const ratedValue = next.rated ?? rated.value
  const sortValue = ratedValue ? null : next.sort === undefined ? sort.value : next.sort
  const orderValue = next.order ?? order.value
  if (q) query.q = q
  if (chain !== undefined) query.chain = String(chain)
  if (ratedValue) query.rated = '1'
  if (sortValue) {
    query.sort = sortValue
    if (orderValue === 'asc') query.order = 'asc'
  }
  if (target > 0) query.page = String(target + 1)
  void router.push({ query })
}

function submit(): void {
  pushQuery({ q: input.value })
}

function setNetwork(value: string | undefined): void {
  const chain = value === undefined || value === 'all' ? null : (envChains.value.find((item) => String(item.chainId) === value)?.chainId ?? null)
  pushQuery({ chain })
}

function pageLink(target: number) {
  return {
    query: {
      ...(search.value ? { q: search.value } : {}),
      ...(chainQuery.value !== undefined ? { chain: String(chainQuery.value) } : {}),
      ...(sort.value ? { sort: sort.value } : {}),
      ...(sort.value && order.value === 'asc' ? { order: 'asc' } : {}),
      ...(target > 0 ? { page: target + 1 } : {}),
    },
  }
}

function toggleRated(): void {
  pushQuery({ rated: !rated.value })
}

function toggleRegistered(): void {
  const nextOrder = sort.value === 'registered' && order.value === 'desc' ? 'asc' : 'desc'
  pushQuery({ sort: 'registered', order: nextOrder, rated: false })
}
</script>

<template>
  <div class="page-head">
    <h1>
      Agents
      <small>
        {{ networkEnv === 'testnet' ? 'Testnet' : 'Mainnet' }} ·
        <ChainName v-if="selectedChain" :chain-id="selectedChain.chainId" :name="selectedChain.name" />
        <template v-else>All networks</template>
        <template v-if="loading || !data"> · <Skeleton width="8em" height="0.75em" /></template>
        <template v-else-if="data.total !== undefined"> · {{ data.total.toLocaleString() }} registered</template>
      </small>
    </h1>
    <div class="agent-tools">
      <button class="filter-toggle" type="button" :aria-pressed="rated" :class="{ on: rated }" @click="toggleRated">
        Most rated
      </button>
      <SelectMenu
        :model-value="networkValue"
        :options="networkOptions"
        label="Network"
        placeholder="All networks"
        compact
        @update:model-value="setNetwork"
      />
      <form class="search" role="search" @submit.prevent="submit">
        <input v-model="input" type="search" placeholder="Search by name or token ID" aria-label="Search agents" />
        <button type="submit">Search</button>
      </form>
    </div>
  </div>

  <section v-if="error" class="state">
    <p>Could not load agents: {{ error }}</p>
    <button @click="reload">Retry</button>
  </section>
  <TableSkeleton
    v-else-if="loading || !data"
    label="Loading agents"
    :headers="['Agent', 'ID', 'Chain', 'Services', 'Score', 'Feedback', 'Owner', 'Registered']"
    :numeric="['ID', 'Feedback', 'Registered']"
  />
  <section v-else-if="!hasRows" class="state muted">
    {{ search ? `No agent matches “${search}”.` : 'No agents registered yet.' }}
  </section>
  <template v-else>
    <div class="table-wrap">
      <table class="agents-table">
        <colgroup>
          <col style="width: 27%" />
          <col style="width: 9%" />
          <col style="width: 10%" />
          <col style="width: 13%" />
          <col style="width: 11%" />
          <col style="width: 8%" />
          <col style="width: 12%" />
          <col style="width: 10%" />
        </colgroup>
        <thead>
          <tr>
            <th>Agent</th>
            <th class="num">ID</th>
            <th>Chain</th>
            <th>Services</th>
            <th>Score</th>
            <th class="num">Feedback</th>
            <th>Owner</th>
            <SortHeader label="Registered" numeric :active="registeredSort" @sort="toggleRegistered" />
          </tr>
        </thead>
        <tbody>
          <!-- bookmarks: pinned block — drop and loop `data.items` instead -->
          <ScanAgentRow
            v-for="agent in pinned"
            :key="`pin:${agent.chainId}:${agent.tokenId}`"
            :agent="agent"
            :chain-name="chainMap.get(agent.chainId)?.name"
            :chain-key="chainMap.get(agent.chainId)?.key"
            bookmarked
          />
          <ScanAgentRow
            v-for="agent in feed"
            :key="`${agent.chainId}:${agent.tokenId}`"
            :agent="agent"
            :chain-name="chainMap.get(agent.chainId)?.name"
            :chain-key="chainMap.get(agent.chainId)?.key"
          />
        </tbody>
      </table>
    </div>
    <nav v-if="!rated && (page > 0 || data.hasMore)" class="pager" aria-label="Pagination">
      <RouterLink v-if="page > 0" :to="pageLink(page - 1)">{{ sort ? '← Previous' : '← Newer' }}</RouterLink>
      <span v-else class="muted">{{ sort ? '← Previous' : '← Newer' }}</span>
      <span>Page {{ page + 1 }}</span>
      <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">{{ sort ? 'Next →' : 'Older →' }}</RouterLink>
      <span v-else class="muted">{{ sort ? 'Next →' : 'Older →' }}</span>
    </nav>
  </template>
</template>
