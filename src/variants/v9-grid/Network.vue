<script setup lang="ts">
import { computed, ref } from 'vue'
import type { LookalikeGroup, SuspectReviewer } from '../../data/networkStats'
import type { FeedbackEvent } from '../../data/types'
import { formatDate, formatNumber, formatPercent, shortAddress } from '../../format'
import { activeDays, gini, labelsText, topShare, velocity } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import Sheet from './Sheet.vue'
import type { Column } from './sheet'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)

type Tab = 'summary' | 'feed' | 'agents' | 'reviewers' | 'suspects' | 'rings'
const tab = ref<Tab>('summary')
type Agg = { id: string; tokenId?: bigint; name?: string; rows: number; revoked: number; sum: number; peers: Set<string>; first?: number; last?: number }
// Every agent and every reviewer of the window, not only the top ten.
function aggregate(keyOf: (r: FeedbackEvent) => string, peerOf: (r: FeedbackEvent) => string): Agg[] {
  const by = new Map<string, Agg>()
  for (const r of feed.value?.items ?? []) {
    const k = keyOf(r)
    const e = by.get(k) ?? { id: k, tokenId: r.tokenId, name: r.agentName, rows: 0, revoked: 0, sum: 0, peers: new Set<string>() }
    e.rows++
    if (r.revoked) e.revoked++
    else e.sum += r.value
    e.peers.add(peerOf(r))
    if (r.createdAt !== undefined) {
      e.first = Math.min(e.first ?? Infinity, r.createdAt)
      e.last = Math.max(e.last ?? 0, r.createdAt)
    }
    by.set(k, e)
  }
  return [...by.values()]
}
const agents = computed(() => aggregate((r) => String(r.tokenId), (r) => r.client.toLowerCase()))
const reviewers = computed(() => aggregate((r) => r.client.toLowerCase(), (r) => String(r.tokenId)))
const avgOf = (a: Agg) => (a.rows - a.revoked ? a.sum / (a.rows - a.revoked) : null)

const feedCols: Column<FeedbackEvent>[] = [
  { key: 'when', label: 'Date', get: (r) => r.createdAt, show: (r) => (r.createdAt ? formatDate(r.createdAt) : ''), num: true, formula: 'block.timestamp' },
  { key: 'agent', label: 'Agent', get: (r) => r.agentName ?? `#${r.tokenId}`, link: (r) => to.agent(r.tokenId), formula: 'agentId → name' },
  { key: 'id', label: 'ID', get: (r) => Number(r.tokenId), num: true, formula: 'agentId' },
  { key: 'client', label: 'Reviewer', get: (r) => r.client, show: (r) => shortAddress(r.client), link: (r) => to.reviewer(r.client), formula: 'clientAddress' },
  { key: 'value', label: 'Value', get: (r) => r.value, num: true, formula: 'value / 10^decimals' },
  { key: 'tag1', label: 'Tag 1', get: (r) => r.tag1, formula: 'tag1' },
  { key: 'tag2', label: 'Tag 2', get: (r) => r.tag2, formula: 'tag2', hidden: true },
  { key: 'revoked', label: 'Revoked', get: (r) => (r.revoked ? 'TRUE' : 'FALSE'), formula: 'FeedbackRevoked' },
  { key: 'uri', label: 'File', get: (r) => r.feedbackURI, formula: 'feedbackURI', hidden: true },
]
const aggCols = (kind: 'agent' | 'reviewer'): Column<Agg>[] => [
  kind === 'agent'
    ? { key: 'name', label: 'Agent', get: (a) => a.name ?? `#${a.tokenId}`, link: (a) => to.agent(a.tokenId!), formula: 'agentId → name' }
    : { key: 'name', label: 'Reviewer', get: (a) => a.id, show: (a) => shortAddress(a.id), link: (a) => to.reviewer(a.id), formula: 'clientAddress' },
  { key: 'rows', label: 'Rows', get: (a) => a.rows, num: true, formula: 'COUNT(rows)' },
  { key: 'peers', label: kind === 'agent' ? 'Reviewers' : 'Agents', get: (a) => a.peers.size, num: true, formula: 'COUNTUNIQUE(peer)', tone: (a) => (a.peers.size === 1 && a.rows > 2 ? 'warn' : undefined) },
  { key: 'avg', label: 'Average', get: avgOf, num: true, formula: 'AVERAGE(value) non-revoked' },
  { key: 'rev', label: 'Revoked', get: (a) => a.revoked, num: true, formula: 'COUNTIF(revoked)' },
  { key: 'rpp', label: 'Rows/peer', get: (a) => a.rows / a.peers.size, num: true, formula: 'rows / peers' },
  { key: 'first', label: 'First', get: (a) => a.first, show: (a) => (a.first ? formatDate(a.first) : ''), num: true, formula: 'MIN(date)', hidden: true },
  { key: 'last', label: 'Last', get: (a) => a.last, show: (a) => (a.last ? formatDate(a.last) : ''), num: true, formula: 'MAX(date)' },
]
const suspectCols: Column<SuspectReviewer>[] = [
  { key: 'client', label: 'Reviewer', get: (s) => s.client, show: (s) => shortAddress(s.client), link: (s) => to.reviewer(s.client), formula: 'clientAddress' },
  { key: 'rows', label: 'Rows', get: (s) => s.rows, num: true, formula: 'COUNT(rows)' },
  { key: 'agents', label: 'Agents', get: (s) => s.agents, num: true, formula: 'COUNTUNIQUE(agentId)' },
  { key: 'avg', label: 'Average', get: (s) => s.average, num: true, formula: 'AVERAGE(value)' },
  { key: 'susp', label: 'Suspicion', get: (s) => s.suspicion, num: true, formula: 'weighted label count' },
  { key: 'labels', label: 'Rules', get: (s) => labelsText(s.labels), formula: 'reviewer rules that fired', tone: () => 'warn' },
]
const ringCols: Column<LookalikeGroup>[] = [
  { key: 'agents', label: 'Agents', get: (g) => g.agents.map((a) => a.agentName ?? `#${a.tokenId}`).join(', '), formula: 'group members', width: '360px' },
  { key: 'n', label: 'Size', get: (g) => g.agents.length, num: true, formula: 'COUNT(agents)' },
  { key: 'rev', label: 'Shared reviewers', get: (g) => g.reviewers.length, num: true, formula: 'COUNT(∩ reviewers)' },
  { key: 'sim', label: 'Overlap', get: (g) => g.similarity, show: (g) => formatPercent(g.similarity), num: true, formula: 'Jaccard(reviewer sets) ≥ 0.8' },
]
const cells = computed(() => {
  const s = stats.value
  const items = feed.value?.items ?? []
  if (!s) return []
  const perAgent = agents.value.map((a) => a.rows)
  const perRev = reviewers.value.map((a) => a.rows)
  return [
    { label: 'Rows', value: s.rows, formula: 'COUNT(feed)' },
    { label: 'Agents', value: s.agents, formula: 'COUNTUNIQUE(agentId)' },
    { label: 'Reviewers', value: s.reviewers, formula: 'COUNTUNIQUE(client)' },
    { label: 'Average', value: formatNumber(s.average), formula: 'AVERAGE(value) non-revoked' },
    { label: 'Ecosystem avg', value: formatNumber(ecosystem.data.value?.averageFeedback), formula: '8004scan stats' },
    { label: 'Perfect 100s', value: formatPercent(s.perfectShare), formula: 'COUNTIF(value=100)/COUNT' },
    { label: 'Revoked', value: s.revoked, formula: 'COUNTIF(revoked)' },
    { label: 'Revoke rate', value: formatPercent(s.revoked / Math.max(1, s.rows)), formula: 'revoked / rows' },
    { label: 'Rows / day', value: formatNumber(velocity(items.map((r) => r.createdAt))), formula: 'rows / days(first→last)' },
    { label: 'Active days', value: activeDays(items.map((r) => r.createdAt)).days, formula: 'COUNTUNIQUE(day)' },
    { label: 'Agent Gini', value: formatNumber(gini(perAgent), 2), formula: 'GINI(rows per agent)' },
    { label: 'Reviewer Gini', value: formatNumber(gini(perRev), 2), formula: 'GINI(rows per reviewer)' },
    { label: 'Top-10 agent share', value: formatPercent(topShare(perAgent, 10)), formula: 'SUM(LARGE(rows,1..10))/rows' },
    { label: 'Single-reviewer agents', value: agents.value.filter((a) => a.peers.size === 1).length, formula: 'COUNTIF(reviewers=1)' },
    { label: 'Suspects', value: s.suspects.length, formula: 'COUNT(reviewers with a rule)' },
    { label: 'Rings', value: s.lookalikes.length, formula: 'COUNT(lookalike groups)' },
  ]
})
</script>

<template>
  <div class="x-title">
    <h1>Network · {{ chain.name }}</h1>
    <span v-if="stats" class="soft">{{ stats.from && stats.to ? `${formatDate(stats.from)} – ${formatDate(stats.to)}` : '' }}</span>
    <button v-if="feed?.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Append older rows' }}</button>
  </div>
  <p v-if="error" class="x-note">#ERROR! {{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="soft">Calculating…</p>
  <template v-if="stats && feed">
    <div v-if="tab === 'summary'" class="x-cards">
      <div v-for="c in cells" :key="c.label"><label>{{ c.label }}</label><b>{{ c.value }}</b><code>={{ c.formula }}</code></div>
    </div>
    <Sheet v-else-if="tab === 'feed'" :rows="feed.items" :columns="feedCols" :name="`feed-${chain.slug}`" :row-class="(r) => (r.revoked ? 'revoked' : undefined)" />
    <Sheet v-else-if="tab === 'agents'" :rows="agents" :columns="aggCols('agent')" :name="`agents-window-${chain.slug}`" />
    <Sheet v-else-if="tab === 'reviewers'" :rows="reviewers" :columns="aggCols('reviewer')" :name="`reviewers-window-${chain.slug}`" />
    <Sheet v-else-if="tab === 'suspects'" :rows="stats.suspects" :columns="suspectCols" :name="`suspects-${chain.slug}`" />
    <Sheet v-else :rows="stats.lookalikes" :columns="ringCols" :name="`rings-${chain.slug}`" />
    <nav class="x-tabs">
      <button v-for="t in (['summary', 'feed', 'agents', 'reviewers', 'suspects', 'rings'] as Tab[])" :key="t" :class="{ on: tab === t }" @click="tab = t">
        {{ { summary: 'Summary', feed: `Feed (${feed.items.length})`, agents: `Agents (${agents.length})`, reviewers: `Reviewers (${reviewers.length})`, suspects: `Suspects (${stats.suspects.length})`, rings: `Rings (${stats.lookalikes.length})` }[t] }}
      </button>
    </nav>
  </template>
</template>
