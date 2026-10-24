<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Address } from 'viem'
import { formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { useAddress, useChain, useNetwork } from '../shared/use'
import AgentPane from './AgentPane.vue'
import List from './List.vue'
import ReviewerPane from './ReviewerPane.vue'

// Serves /network/:slug and /reviewers/:slug/:address; a reviewer in the URL is the selection.
const props = defineProps<{ slug: string; address?: string }>()
const chain = useChain(() => props.slug)
const router = useRouter()
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const routeAddress = useAddress(() => props.address ?? '')

type Mode = 'suspects' | 'reviewers' | 'agents' | 'rings' | 'feed'
const mode = ref<Mode>(props.address ? 'reviewers' : 'suspects')
type Entry = { key: string; kind: 'reviewer' | 'agent'; target: string; title: string; sub: string; num: string; dim?: boolean }
const pickedAgent = ref<string>()

const entries = computed<Entry[]>(() => {
  const s = stats.value
  const items = feed.value?.items ?? []
  if (!s) return []
  if (mode.value === 'suspects') return s.suspects.map((x) => ({ key: x.client, kind: 'reviewer', target: x.client, title: shortAddress(x.client), sub: labelsText(x.labels), num: String(x.rows) }))
  if (mode.value === 'agents') return s.topAgents.map((a) => ({ key: String(a.tokenId), kind: 'agent', target: String(a.tokenId), title: a.agentName ?? `Agent #${a.tokenId}`, sub: `${a.rows} reviews · ${a.reviewers} reviewers`, num: formatNumber(a.average) }))
  if (mode.value === 'rings')
    return s.lookalikes.map((g, i) => ({ key: `ring${i}`, kind: 'agent', target: String(g.agents[0].tokenId), title: g.agents.map((a) => a.agentName ?? `#${a.tokenId}`).join(', '), sub: `${g.reviewers.length} shared reviewers`, num: formatPercent(g.similarity) }))
  if (mode.value === 'feed')
    return items.slice(0, 200).map((r, i) => ({ key: `f${i}`, kind: 'agent', target: String(r.tokenId), title: r.agentName ?? `Agent #${r.tokenId}`, sub: `${shortAddress(r.client)} · ${r.createdAt ? formatTimeline(r.createdAt) : ''}`, num: formatScore(r.value), dim: r.revoked }))
  // Every reviewer of the window, busiest first.
  const by = new Map<string, { n: number; agents: Set<string> }>()
  for (const r of items) {
    const e = by.get(r.client) ?? { n: 0, agents: new Set<string>() }
    e.n++
    e.agents.add(String(r.tokenId))
    by.set(r.client, e)
  }
  return [...by.entries()].sort((a, b) => b[1].n - a[1].n).map(([c, e]) => ({ key: c, kind: 'reviewer', target: c, title: shortAddress(c), sub: `${e.agents.size} agents`, num: String(e.n) }))
})
const selectedKey = computed(() => {
  if (pickedAgent.value) return entries.value.find((e) => e.kind === 'agent' && e.key === pickedAgent.value)?.key ?? pickedAgent.value
  const a = routeAddress.value?.toLowerCase()
  return a ? entries.value.find((e) => e.kind === 'reviewer' && e.target.toLowerCase() === a)?.key : undefined
})
function select(e: Entry): void {
  if (e.kind === 'reviewer') {
    pickedAgent.value = undefined
    void router.replace({ name: 'reviewer', params: { slug: props.slug, address: e.target } })
  } else {
    pickedAgent.value = e.key
  }
}
const agentTarget = computed(() => entries.value.find((e) => e.key === pickedAgent.value)?.target)
</script>

<template>
  <div class="i-split">
    <section class="i-list">
      <header>
        <h2><span>{{ chain.name }}</span><span class="soft">{{ stats ? `${stats.rows} reviews` : '' }}</span></h2>
        <p v-if="stats" class="soft" style="margin: 0">
          avg {{ formatNumber(stats.average) }} (eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }}) · {{ formatPercent(stats.perfectShare) }} perfect · {{ stats.agents }} agents · {{ stats.reviewers }} reviewers
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 4px">
          <button v-for="m in (['suspects', 'reviewers', 'agents', 'rings', 'feed'] as Mode[])" :key="m" :style="mode === m ? 'background: var(--sel); border-color: var(--sel)' : ''" @click="mode = m">
            {{ { suspects: `Suspects ${stats?.suspects.length ?? ''}`, reviewers: 'Reviewers', agents: 'Busiest', rings: `Rings ${stats?.lookalikes.length ?? ''}`, feed: 'Feed' }[m] }}
          </button>
        </div>
      </header>
      <p v-if="error" class="i-notice">{{ error }} <button @click="load()">Retry</button></p>
      <p v-else-if="!stats" class="soft" style="padding: 12px">Loading the latest feedback…</p>
      <List v-else :items="entries" :key-of="(e) => e.key" :selected="selectedKey" @select="select">
        <template #default="{ item: e }">
          <div class="main" :style="{ opacity: e.dim ? 0.5 : 1 }"><b :class="{ mono: e.kind === 'reviewer' }">{{ e.title }}</b><span class="soft">{{ e.sub }}</span></div>
          <span class="i-num">{{ e.num }}</span>
        </template>
        <template #after>
          <p v-if="!entries.length" class="soft" style="padding: 12px">Nothing in this list for the current window.</p>
          <p style="padding: 10px 12px"><button v-if="feed?.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Widen window' }}</button></p>
        </template>
      </List>
    </section>
    <section class="i-detail">
      <AgentPane v-if="agentTarget" :key="`a${agentTarget}`" :chain="chain" :id="agentTarget" />
      <ReviewerPane v-else-if="routeAddress" :key="routeAddress" :chain="chain" :address="routeAddress as Address" />
      <div v-else class="i-empty"><div>{{ props.address ? `“${props.address}” is not an address.` : 'Select a reviewer or an agent.' }}</div></div>
    </section>
  </div>
</template>
