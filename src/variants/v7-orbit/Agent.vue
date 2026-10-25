<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { effectiveCount } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import Ego from './Ego.vue'
import { REVIEWER, SUSPECT, type Satellite } from './orbit'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

const sats = computed<Satellite[]>(() =>
  (stats.value?.reviewers ?? []).map((r) => ({
    id: r.client.toLowerCase(),
    label: shortAddress(r.client),
    size: r.rows,
    value: r.average,
    color: r.flags.length ? SUSPECT : REVIEWER,
    title: `${r.client} · ${r.rows} feedback · avg ${formatNumber(r.average)}${r.flags.length ? ` · ${r.flags.join(', ')}` : ''}`,
  })),
)
const picked = ref<string>()
const reviewer = computed(() => stats.value?.reviewers.find((r) => r.client.toLowerCase() === picked.value))
const rows = computed(() => (agent.value?.feedback ?? []).map((row, index) => ({ row, index })).filter(({ row }) => !picked.value || row.client.toLowerCase() === picked.value))
const open = ref<number>()
// Mean orbit: share-weighted distance of the crowd (0 = everyone gives 100).
const orbit = computed(() => {
  const rs = stats.value?.reviewers ?? []
  const valid = rs.filter((r) => r.average !== null)
  return valid.length ? valid.reduce((n, r) => n + r.share * (1 - r.average! / 100), 0) / Math.max(1e-9, valid.reduce((n, r) => n + r.share, 0)) : null
})
function flags(f: RowFlag[]): string[] {
  return f.filter((x) => x !== 'revoked').map((x) => FLAG_INFO[x].label)
}
</script>

<template>
  <p v-if="error" class="o-notice">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="soft">Locating…</p>
  <h1 v-else-if="agent === null" class="o-title">No agent #{{ id }} in this sky</h1>
  <template v-else>
    <p class="soft"><RouterLink :to="to.agents()">Star field</RouterLink> / #{{ agent.tokenId }}</p>
    <h1 class="o-title">{{ file === undefined ? '…' : name }}</h1>
    <p class="o-sub">{{ file?.description ?? '' }}</p>
    <div class="o-stage">
      <div>
        <Ego v-if="sats.length" :center="name" :satellites="sats" :selected="picked" @pick="(id) => (picked = picked === id ? undefined : id)" />
        <p v-else class="soft">No reviewer orbits this agent yet.</p>
        <div class="o-legend">
          <span>closer = kinder average · size = feedback</span>
          <span><i :style="{ background: REVIEWER }" />reviewer</span>
          <span><i :style="{ background: SUSPECT }" />flagged by a rule</span>
          <span>click a body to read only its feedback</span>
        </div>
      </div>
      <aside>
        <section v-if="report && stats && agent.feedback.length" class="o-panel">
          <h3>Gravity</h3>
          <p style="margin: 0 0 8px">{{ report.headline }}</p>
          <dl class="o-kv">
            <dt>Trusted</dt><dd><b>{{ formatNumber(report.trusted) }}</b></dd>
            <dt>Raw</dt><dd>{{ formatNumber(report.raw) }}</dd>
            <dt>95% bound</dt><dd>{{ formatNumber(report.lcb) }}</dd>
            <dt>Evidence / risk</dt><dd>{{ report.strength.tier }} / {{ stats.level }}</dd>
            <dt title="1 / Σ share²">Independent voices</dt><dd>{{ formatNumber(effectiveCount(stats.reviewers.map((r) => r.rows))) }}</dd>
            <dt title="Share-weighted 1 − average/100">Mean orbit</dt><dd>{{ formatNumber(orbit, 2) }}</dd>
            <dt>8004scan · eco</dt><dd>{{ scan.data.value ? formatNumber(scan.data.value.total) : '—' }} · {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</dd>
          </dl>
          <p v-for="s in stats.signals" :key="s.code" style="margin: 6px 0 0; font-size: 13px"><span class="o-chip" :class="s.level === 'high' || s.level === 'warn' ? 'sus' : ''">{{ s.level }}</span>{{ s.text }}</p>
        </section>
        <section v-if="reviewer" class="o-panel">
          <h3>Selected body</h3>
          <p style="margin: 0"><RouterLink :to="to.reviewer(reviewer.client)" class="mono">{{ reviewer.client }}</RouterLink></p>
          <dl class="o-kv" style="margin-top: 6px">
            <dt>Feedback</dt><dd>{{ reviewer.rows }}</dd>
            <dt>Average</dt><dd>{{ formatNumber(reviewer.average) }}</dd>
            <dt>Share / weight share</dt><dd>{{ formatPercent(reviewer.share) }} / {{ formatPercent(reviewer.weightShare) }}</dd>
            <dt>Pull on the average</dt><dd>{{ formatSigned(reviewer.shiftWithout === null ? null : -reviewer.shiftWithout) }}</dd>
          </dl>
          <button style="margin-top: 8px" @click="picked = undefined">Show everyone</button>
        </section>
        <section class="o-panel">
          <h3>Signals received · {{ rows.length }}</h3>
          <ul class="o-list">
            <template v-for="r in rows" :key="r.index">
              <li style="cursor: pointer; flex-wrap: wrap" :style="{ opacity: r.row.revoked ? 0.4 : 1 }" @click="open = open === r.index ? undefined : r.index">
                <span><b>{{ formatScore(r.row.value) }}</b> <span class="mono soft">{{ shortAddress(r.row.client) }}</span> <span v-for="f in flags(stats?.rows[r.index]?.flags ?? [])" :key="f" class="o-chip sus">{{ f }}</span></span>
                <span class="soft">{{ r.row.createdAt ? formatTimeline(r.row.createdAt) : '' }}</span>
                <FeedbackNote v-if="r.row.feedbackURI" :uri="r.row.feedbackURI" style="flex-basis: 100%" />
              </li>
              <li v-if="open === r.index && stats" style="display: block"><TxPanel :chain="chain" :agent="agent" :row="r.row" :index="r.index" :stats="stats" /></li>
            </template>
          </ul>
        </section>
        <section class="o-panel">
          <h3>Coordinates</h3>
          <dl class="o-kv">
            <dt>Owner</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">{{ shortAddress(agent.owner) }}</RouterLink></dd>
            <dt>Wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(agent.agentWallet) }}</a><span v-else class="soft">not set</span>{{ walletIsOwner ? ' =' : '' }}</dd>
            <dt>URI</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">file ↗</a><span v-else class="soft">{{ agent.agentURI ? 'inline' : 'none' }}</span></dd>
            <dt v-if="agent.createdAt">Born</dt><dd v-if="agent.createdAt">{{ formatDate(agent.createdAt) }}</dd>
            <dt>Status</dt><dd>{{ file?.active === true ? 'active' : file?.active === false ? 'inactive' : '—' }}{{ file?.x402Support ? ' · x402' : '' }}</dd>
          </dl>
          <p style="margin: 8px 0 0"><span v-for="s in file?.services ?? []" :key="s.name + s.endpoint" class="o-chip agent" :title="s.endpoint">{{ s.name }}</span></p>
          <p style="margin: 4px 0 0"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></p>
          <details v-if="rawJson"><summary class="soft">Raw file</summary><pre>{{ rawJson }}</pre></details>
        </section>
      </aside>
    </div>
  </template>
</template>
