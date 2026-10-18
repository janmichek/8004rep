<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isAddress, type Address } from 'viem'
import { identityAbi } from '../abi'
import { addressExplorerUrl, findChainBySlug } from '../chains'
import AgentRow from '../components/AgentRow.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import StatTiles, { type Tile } from '../components/ui/StatTiles.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { sourceFor } from '../data'
import { getScores } from '../data/rpc'
import type { ReputationSummary } from '../data/types'
import { formatScore, shortAddress } from '../format'
import { useAsync } from '../useAsync'

const PAGE_SIZE = 25

const props = defineProps<{ slug: string; address: string }>()
const route = useRoute()

const chain = computed(() => findChainBySlug(props.slug)!)
const address = computed(() => (isAddress(props.address, { strict: false }) ? (props.address as Address) : undefined))
const page = computed(() => Math.max(0, Math.trunc(Number(route.query.page) || 1) - 1))

const { data, error, loading, reload } = useAsync(async () => {
  if (!address.value) return null
  const { source, rpcClient } = await sourceFor(chain.value)
  const listed = await source.listAgents({ page: page.value, pageSize: PAGE_SIZE, owner: address.value })
  // Indexed lists have no total; the registry's balance is the owned count.
  let owned = listed.total
  if (owned === undefined) {
    try {
      owned = Number(
        await rpcClient.readContract({
          address: chain.value.identity,
          abi: identityAbi,
          functionName: 'balanceOf',
          args: [address.value],
        }),
      )
    } catch {
      owned = undefined
    }
  }
  return { ...listed, owned }
}, () => [chain.value, address.value, page.value])

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

function pageLink(target: number) {
  return { query: target > 0 ? { page: target + 1 } : {} }
}

const owned = computed(() => data.value?.owned ?? 0)
const scored = computed(() => {
  const map = scores.value
  if (!map) return null
  let total = 0
  let rated = 0
  let sum = 0
  map.forEach((s, _id) => {
    if (s.count > 0) {
      rated++
      sum += s.average
      total += s.count
    }
  })
  return { rated, sum, total, avg: rated ? sum / rated : 0 }
})

const tiles = computed<Tile[]>(() => {
  const s = scored.value
  return [
    {
      label: 'Owned agents',
      value: String(owned.value),
      title: `Agents this address owns on ${chain.value.name}`,
      tone: 'main',
    },
    {
      label: 'Rated',
      value: s ? String(s.rated) : '—',
      hint: s ? `of ${owned.value} owned` : '',
      title: 'Owned agents that have at least one feedback row',
      loading: s === null,
    },
    {
      label: 'Average rating',
      value: s ? formatScore(s.avg) : '—',
      hint: s ? `${s.total} rated rows across ${s.rated} agents` : '',
      title: 'Simple average of each owned agent\'s on-chain average',
      loading: s === null,
      tone: s && s.avg >= 75 ? 'good' : s && s.avg > 0 ? undefined : 'quiet',
    },
  ]
})
</script>

<template>
  <p class="crumbs">
    <RouterLink :to="{ name: 'agents', params: { slug: chain.slug } }">← {{ chain.name }} agents</RouterLink>
  </p>

  <section v-if="!address" class="state">
    <h1>Not an address</h1>
    <p class="muted">“{{ props.address }}” is not a 0x address.</p>
  </section>

  <template v-else>
    <div class="page-head">
      <h1>
        Owner <span class="mono">{{ shortAddress(address) }}</span>
        <small v-if="loading || !data"><Skeleton width="6em" height="0.75em" /></small>
        <small v-else-if="data.owned !== undefined">{{ data.owned }} {{ data.owned === 1 ? 'agent' : 'agents' }}</small>
      </h1>
      <p class="meta">
        <span class="mono">{{ address }}</span>
        <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">Explorer ↗</a>
      </p>
    </div>

    <template v-if="data && !loading">
      <StatTiles :tiles="tiles" />
    </template>

    <section v-if="error" class="state">
      <p>Could not load agents: {{ error }}</p>
      <button @click="reload">Retry</button>
    </section>
    <TableSkeleton
      v-else-if="loading || !data"
      label="Loading agents"
      :headers="['Agent', 'ID', 'Services', 'Feedback', 'Created']"
      :numeric="['ID', 'Feedback', 'Created']"
    />
    <template v-else>
      <section v-if="data.items.length === 0" class="state muted">
        {{ page > 0 ? 'No more agents on this page.' : `This address owns no agents on ${chain.name}.` }}
      </section>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th class="num">ID</th>
              <th>Services</th>
              <th class="num" title="Count and average of all feedback values, any tag">Feedback</th>
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
              hide-owner
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
</template>
