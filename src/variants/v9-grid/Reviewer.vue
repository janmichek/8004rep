<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import type { AgentShare } from '../../data/reviewerProfile'
import { LABEL_INFO } from '../../data/reviewerProfile'
import type { FeedbackEvent } from '../../data/types'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import { activeDays, evenness, labelsText, velocity } from '../shared/metrics'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'
import Sheet from './Sheet.vue'
import type { Column } from './sheet'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
type Tab = 'summary' | 'rows' | 'agents'
const tab = ref<Tab>('summary')
const rowCols: Column<FeedbackEvent>[] = [
  { key: 'when', label: 'Date', get: (r) => r.createdAt, show: (r) => (r.createdAt ? formatDate(r.createdAt) : ''), num: true, formula: 'block.timestamp' },
  { key: 'agent', label: 'Agent', get: (r) => r.agentName ?? `#${r.tokenId}`, link: (r) => to.agent(r.tokenId), formula: 'agentId → name' },
  { key: 'value', label: 'Value', get: (r) => r.value, num: true, formula: 'value' },
  { key: 'tag1', label: 'Tag 1', get: (r) => r.tag1, formula: 'tag1' },
  { key: 'revoked', label: 'Revoked', get: (r) => (r.revoked ? 'TRUE' : 'FALSE'), formula: 'FeedbackRevoked' },
  { key: 'tx', label: 'Tx', get: (r) => r.txHash, show: (r) => (r.txHash ? shortAddress(r.txHash) : ''), href: (r) => (r.txHash ? txExplorerUrl(chain.value, r.txHash) : undefined), formula: 'transactionHash' },
]
const agentCols: Column<AgentShare>[] = [
  { key: 'agent', label: 'Agent', get: (a) => a.agentName ?? `#${a.tokenId}`, link: (a) => to.agent(a.tokenId), formula: 'agentId → name' },
  { key: 'rows', label: 'Rows', get: (a) => a.rows, num: true, formula: 'COUNT' },
  { key: 'avg', label: 'Average', get: (a) => a.average, num: true, formula: 'AVERAGE(value)' },
  { key: 'rev', label: 'Revoked', get: (a) => a.revoked, num: true, formula: 'COUNTIF(revoked)' },
  { key: 'share', label: 'Share', get: (a) => a.rows / Math.max(1, profile.value?.rows ?? 1), show: (a) => formatPercent(a.rows / Math.max(1, profile.value?.rows ?? 1)), num: true, formula: 'rows / all rows' },
]
const cells = computed(() => {
  const p = profile.value
  const w = wallet.data.value
  const times = feed.value?.items.map((r) => r.createdAt) ?? []
  if (!p) return []
  return [
    { label: 'Rows', value: p.rows, formula: 'COUNT' },
    { label: 'Revoked', value: p.revoked, formula: 'COUNTIF(revoked)' },
    { label: 'Agents', value: p.agents, formula: 'COUNTUNIQUE(agentId)' },
    { label: 'Average', value: formatNumber(p.average), formula: 'AVERAGE(value)' },
    { label: 'Mode', value: p.mode ? `${formatScore(p.mode.value)} (${formatPercent(p.mode.share)})` : '—', formula: 'MODE(value)' },
    { label: 'Peak 24h', value: p.peakPerDay, formula: 'MAX(rows in any 24h)' },
    { label: 'Rows / day', value: formatNumber(velocity(times)), formula: 'rows / days' },
    { label: 'Active days', value: activeDays(times).days, formula: 'COUNTUNIQUE(day)' },
    { label: 'Evenness', value: formatPercent(evenness(p.perAgent.map((a) => a.rows))), formula: 'H(agents)/ln(k)' },
    { label: 'Rules', value: labelsText(p.labels) || 'none', formula: 'reviewer rules' },
    { label: 'Nonce', value: w?.nonce ?? '…', formula: 'eth_getTransactionCount' },
    { label: 'Kind', value: w?.kind ?? '…', formula: 'eth_getCode = 0x ?' },
    { label: 'Funder', value: w?.funding ? shortAddress(w.funding.funder) : !chain.value.explorerApiUrl ? 'n/a' : w ? 'none' : '…', formula: 'first incoming transfer' },
  ]
})
</script>

<template>
  <p v-if="!address" class="x-note">#VALUE! — “{{ props.address }}” is not an address.</p>
  <template v-else>
    <div class="x-title">
      <h1 class="mono" style="font-size: 15px">{{ address }}</h1>
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a>
      <a v-if="wallet.data.value?.funding" :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">funding tx ↗</a>
      <button v-if="feed?.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Append older rows' }}</button>
    </div>
    <p v-if="error" class="x-note">#ERROR! {{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="soft">Calculating…</p>
    <template v-if="profile && feed">
      <template v-if="tab === 'summary'">
        <div class="x-cards"><div v-for="c in cells" :key="c.label"><label>{{ c.label }}</label><b>{{ c.value }}</b><code>={{ c.formula }}</code></div></div>
        <p v-for="l in profile.labels" :key="l" class="x-note"><b>{{ LABEL_INFO[l].label }}</b> — {{ LABEL_INFO[l].rule }}</p>
      </template>
      <Sheet v-else-if="tab === 'rows'" :rows="feed.items" :columns="rowCols" :name="`reviewer-rows-${address.slice(0, 8)}`" :row-class="(r) => (r.revoked ? 'revoked' : undefined)" />
      <Sheet v-else :rows="profile.perAgent" :columns="agentCols" :name="`reviewer-agents-${address.slice(0, 8)}`" />
      <nav class="x-tabs">
        <button v-for="t in (['summary', 'rows', 'agents'] as Tab[])" :key="t" :class="{ on: tab === t }" @click="tab = t">
          {{ { summary: 'Summary', rows: `Rows (${feed.items.length})`, agents: `Agents (${profile.agents})` }[t] }}
        </button>
      </nav>
    </template>
  </template>
</template>
