<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl, txExplorerUrl } from '../../chains'
import { FLAG_INFO, type ReviewerStats, type RowStats } from '../../data/feedbackStats'
import type { WaterfallStep } from '../../data/trustReport'
import type { Feedback } from '../../data/types'
import { formatDate, formatNumber, formatPercent, formatSigned, shortAddress } from '../../format'
import { effectiveCount, gini, letterGrade, velocity } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import Sheet from './Sheet.vue'
import type { Column } from './sheet'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, error, loading, reload } = useAgentDetail(chain, () => props.id)

type Tab = 'summary' | 'reviews' | 'reviewers' | 'build' | 'file'
const tab = ref<Tab>('summary')
type Row = { row: Feedback; st?: RowStats; index: number }
const rows = computed<Row[]>(() => (agent.value?.feedback ?? []).map((row, index) => ({ row, st: stats.value?.rows[index], index })))
const picked = ref<Row>()

const reviewCols: Column<Row>[] = [
  { key: 'i', label: 'Row', get: (r) => r.index, num: true, formula: 'feedback index in agent' },
  { key: 'client', label: 'Reviewer', get: (r) => r.row.client, show: (r) => shortAddress(r.row.client), link: (r) => to.reviewer(r.row.client), formula: 'NewFeedback.clientAddress' },
  { key: 'value', label: 'Value', get: (r) => r.row.value, num: true, formula: 'value / 10^valueDecimals', tone: (r) => (r.row.value >= 80 ? 'good' : r.row.value < 50 ? 'bad' : undefined) },
  { key: 'weight', label: 'Weight', get: (r) => r.st?.weight, num: true, formula: 'dup × burst × trust (1 = full vote)', tone: (r) => ((r.st?.weight ?? 1) === 0 ? 'bad' : (r.st?.weight ?? 1) < 1 ? 'warn' : undefined) },
  { key: 'flags', label: 'Flags', get: (r) => r.st?.flags.map((f) => FLAG_INFO[f].label).join(', '), formula: 'rules that fired on this row' },
  { key: 'dev', label: 'Robust z', get: (r) => r.st?.deviation ?? null, num: true, formula: '(value − median) / (1.4826 · MAD)', hidden: true },
  { key: 'tag1', label: 'Tag 1', get: (r) => r.row.tag1, formula: 'NewFeedback.tag1' },
  { key: 'tag2', label: 'Tag 2', get: (r) => r.row.tag2, formula: 'NewFeedback.tag2', hidden: true },
  { key: 'endpoint', label: 'Endpoint', get: (r) => r.row.endpoint, formula: 'NewFeedback.endpoint', hidden: true },
  { key: 'when', label: 'Date', get: (r) => r.row.createdAt, show: (r) => (r.row.createdAt ? formatDate(r.row.createdAt) : ''), num: true, formula: 'block.timestamp' },
  { key: 'replies', label: 'Replies', get: (r) => r.row.responses?.length ?? 0, num: true, formula: 'COUNT(ResponseAppended)' },
  { key: 'revoked', label: 'Revoked', get: (r) => (r.row.revoked ? 'TRUE' : 'FALSE'), formula: 'FeedbackRevoked emitted' },
  { key: 'uri', label: 'File', get: (r) => r.row.feedbackURI, formula: 'NewFeedback.feedbackURI', hidden: true },
  { key: 'tx', label: 'Tx', get: (r) => r.row.txHash, show: (r) => (r.row.txHash ? shortAddress(r.row.txHash) : ''), href: (r) => (r.row.txHash ? txExplorerUrl(chain.value, r.row.txHash) : undefined), formula: 'log.transactionHash' },
]
const reviewerCols: Column<ReviewerStats>[] = [
  { key: 'client', label: 'Reviewer', get: (r) => r.client, show: (r) => shortAddress(r.client), link: (r) => to.reviewer(r.client), formula: 'clientAddress' },
  { key: 'rows', label: 'Rows', get: (r) => r.rows, num: true, formula: 'COUNT(rows)' },
  { key: 'revoked', label: 'Revoked', get: (r) => r.revoked, num: true, formula: 'COUNTIF(revoked)' },
  { key: 'avg', label: 'Average', get: (r) => r.average, num: true, formula: 'AVERAGE(value) non-revoked' },
  { key: 'min', label: 'Min', get: (r) => r.min, num: true, formula: 'MIN(value)', hidden: true },
  { key: 'max', label: 'Max', get: (r) => r.max, num: true, formula: 'MAX(value)', hidden: true },
  { key: 'share', label: 'Share', get: (r) => r.share, show: (r) => formatPercent(r.share), num: true, formula: 'rows / all non-revoked rows' },
  { key: 'wshare', label: 'Weight share', get: (r) => r.weightShare, show: (r) => formatPercent(r.weightShare), num: true, formula: 'Σweight / Σall weights' },
  { key: 'shift', label: 'Avg without', get: (r) => r.shiftWithout, show: (r) => formatSigned(r.shiftWithout), num: true, formula: 'AVERAGE(others) − AVERAGE(all)' },
  { key: 'first', label: 'First', get: (r) => r.first, show: (r) => (r.first ? formatDate(r.first) : ''), num: true, formula: 'MIN(createdAt)' },
  { key: 'last', label: 'Last', get: (r) => r.last, show: (r) => (r.last ? formatDate(r.last) : ''), num: true, formula: 'MAX(createdAt)' },
  { key: 'flags', label: 'Flags', get: (r) => r.flags.map((f) => FLAG_INFO[f].label).join(', '), formula: 'rules that fired on any row' },
]
const buildCols: Column<WaterfallStep>[] = [
  { key: 'label', label: 'Step', get: (s) => s.label, formula: 'rule applied, in order' },
  { key: 'avg', label: 'Average after', get: (s) => s.average, num: true, formula: 'Σ(weight·value) / Σweight' },
  { key: 'delta', label: 'Δ', get: (s) => s.delta, show: (s) => formatSigned(s.delta), num: true, formula: 'average − previous average', tone: (s) => ((s.delta ?? 0) < -1 ? 'warn' : undefined) },
  { key: 'rows', label: 'Rows hit', get: (s) => s.rows, num: true, formula: 'COUNTIF(factor < 1)' },
  { key: 'rule', label: 'Rule', get: (s) => s.rule, formula: 'definition', width: '420px' },
]
// Summary as named cells, each with its formula.
const cells = computed(() => {
  const r = report.value
  const s = stats.value
  const sc = scores.value
  const fb = agent.value?.feedback ?? []
  if (!r || !s || !sc) return []
  return [
    { label: 'Grade', value: letterGrade(r.trusted, r.strength.tier, s.level), formula: 'band(trusted) capped by evidence & risk' },
    { label: 'Trusted', value: formatNumber(r.trusted), formula: 'Σ(w·v)/Σw after every rule' },
    { label: 'Raw', value: formatNumber(r.raw), formula: 'AVERAGE(non-revoked)' },
    { label: 'Lower bound', value: formatNumber(r.lcb), formula: 'weighted − 1.96·sd/√W' },
    { label: 'Median', value: formatNumber(sc.median), formula: 'MEDIAN(values)' },
    { label: 'Trimmed', value: formatNumber(sc.trimmed), formula: 'TRIMMEAN(values, 20%)' },
    { label: 'Bayesian', value: formatNumber(sc.bayes), formula: '(W·weighted + m·prior)/(W + m)' },
    { label: 'Time-weighted', value: formatNumber(sc.timeWeighted), formula: 'half-life decayed mean' },
    { label: 'Momentum', value: formatSigned(sc.momentum), formula: 'tw(30d) − tw(prior 90d)' },
    { label: 'Polarization', value: formatNumber(sc.polarization, 2), formula: '0 united … 1 two camps' },
    { label: 'Consensus', value: formatNumber(sc.consensus, 2), formula: '1 − normalized spread' },
    { label: 'Trust mass', value: formatPercent(sc.trustMass), formula: 'W / n' },
    { label: 'Effective clients', value: formatNumber(sc.clientsEff), formula: 'exp(H(clients))' },
    { label: 'Inverse HHI', value: formatNumber(effectiveCount(s.reviewers.map((x) => x.rows))), formula: '1 / Σ share²' },
    { label: 'Reviewer Gini', value: formatNumber(gini(s.reviewers.map((x) => x.rows)), 2), formula: 'GINI(rows per reviewer)' },
    { label: 'Reviews / day', value: formatNumber(velocity(fb.map((x) => x.createdAt))), formula: 'COUNT / days(first→last)' },
    { label: 'Evidence', value: r.strength.tier, formula: 'independent reviewers & W' },
    { label: 'Risk', value: s.level, formula: 'worst signal level' },
    { label: '8004scan', value: scan.data.value ? formatNumber(scan.data.value.total) : '—', formula: '8004scan public API total' },
    { label: 'Ecosystem avg', value: formatNumber(ecosystem.data.value?.averageFeedback), formula: '8004scan stats.averageFeedback' },
  ]
})
</script>

<template>
  <p v-if="error" class="x-note">#ERROR! {{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="soft">Calculating…</p>
  <p v-else-if="agent === null" class="x-note">#REF! — no agent {{ id }} on {{ chain.name }}</p>
  <template v-else>
    <div class="x-title">
      <h1>{{ file === undefined ? '…' : name }}</h1>
      <span class="soft">{{ chain.chainId }}:{{ agent.tokenId }}</span>
      <RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">owner {{ shortAddress(agent.owner) }}</RouterLink>
      <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono">wallet {{ shortAddress(agent.agentWallet) }}</a>
      <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a>
      <RouterLink :to="to.agents()">← Agents</RouterLink>
    </div>
    <template v-if="tab === 'summary'">
      <p v-if="!agent.feedback.length" class="x-note">No feedback — every score cell is #DIV/0!</p>
      <p v-else-if="report" style="margin: 0 0 10px">{{ report.headline }}</p>
      <div class="x-cards">
        <div v-for="c in cells" :key="c.label"><label>{{ c.label }}</label><b>{{ c.value }}</b><code>={{ c.formula }}</code></div>
      </div>
      <Sheet v-if="stats?.signals.length" :rows="stats.signals" :name="`signals-${agent.tokenId}`" :columns="[
        { key: 'level', label: 'Level', get: (s) => s.level, formula: 'signal level', tone: (s) => (s.level === 'high' ? 'bad' : s.level === 'warn' ? 'warn' : undefined) },
        { key: 'code', label: 'Code', get: (s) => s.code, formula: 'signal id' },
        { key: 'text', label: 'Finding', get: (s) => s.text, formula: 'rule text', width: '520px' },
      ]" />
    </template>
    <template v-else-if="tab === 'reviews' && stats">
      <p v-if="agent.feedbackSince" class="soft">Dated from {{ formatDate(agent.feedbackSince) }} (log scan). Double-click a row for its tx detail.</p>
      <Sheet :rows="rows" :columns="reviewCols" :name="`reviews-${agent.tokenId}`" :row-class="(r) => (r.row.revoked ? 'revoked' : undefined)" @select="(r) => (picked = r)" />
      <TxPanel v-if="picked" :key="picked.index" :chain="chain" :agent="agent" :row="picked.row" :index="picked.index" :stats="stats" />
    </template>
    <Sheet v-else-if="tab === 'reviewers' && stats" :rows="stats.reviewers" :columns="reviewerCols" :name="`reviewers-${agent.tokenId}`" />
    <Sheet v-else-if="tab === 'build' && report" :rows="report.waterfall" :columns="buildCols" :name="`score-build-${agent.tokenId}`" />
    <template v-else-if="tab === 'file'">
      <div class="x-cards">
        <div><label>Agent URI</label><b class="mono"><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><template v-else>{{ agent.agentURI ?? '—' }}</template></b></div>
        <div><label>Active</label><b>{{ file?.active ?? '—' }}</b></div>
        <div><label>x402</label><b>{{ file?.x402Support ?? '—' }}</b></div>
        <div><label>Registered</label><b>{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</b></div>
      </div>
      <Sheet v-if="file?.services.length" :rows="file.services" :name="`services-${agent.tokenId}`" :columns="[
        { key: 'name', label: 'Service', get: (s) => s.name, formula: 'services[].name' },
        { key: 'endpoint', label: 'Endpoint', get: (s) => s.endpoint, formula: 'services[].endpoint', width: '360px' },
        { key: 'version', label: 'Version', get: (s) => s.version, formula: 'services[].version' },
      ]" />
      <pre v-if="rawJson">{{ rawJson }}</pre>
      <p v-else class="x-note">{{ file === undefined ? 'Loading…' : 'Registration file unreachable.' }}</p>
    </template>
    <nav class="x-tabs">
      <button v-for="t in (['summary', 'reviews', 'reviewers', 'build', 'file'] as Tab[])" :key="t" :class="{ on: tab === t }" @click="tab = t">
        {{ { summary: 'Summary', reviews: `Reviews (${agent.feedback.length})`, reviewers: `Reviewers (${stats?.reviewers.length ?? 0})`, build: 'Score build', file: 'Registration' }[t] }}
      </button>
    </nav>
  </template>
</template>
