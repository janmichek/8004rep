<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { addressExplorerUrl, agentScanUrl, txExplorerUrl, type ChainInfo } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { effectiveCount, letterGrade, runningAverage, sparkPath100 } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail } from '../shared/use'

const props = defineProps<{ chain: ChainInfo; id: string }>()
const chain = computed(() => props.chain)
const to = routes(() => props.chain)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

type Tab = 'overview' | 'feedback' | 'reviewers' | 'file'
const tab = ref<Tab>('overview')
const drawer = ref<number>()
watch(
  () => props.id,
  () => (drawer.value = undefined),
)
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') drawer.value = undefined
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const trend = computed(() => sparkPath100(runningAverage(agent.value?.feedback ?? []).map((p) => p.average), 220, 40))
const reviewerFilter = ref<string>()
const rows = computed(() => (agent.value?.feedback ?? []).map((row, index) => ({ row, index })).filter(({ row }) => !reviewerFilter.value || row.client.toLowerCase() === reviewerFilter.value))
function flags(f: RowFlag[]): string[] {
  return f.filter((x) => x !== 'revoked').map((x) => FLAG_INFO[x].label)
}
const TONE: Record<string, string> = { high: 'bad', warn: 'warn', info: '', clean: 'ok' }
</script>

<template>
  <div class="inner">
    <p v-if="error" class="i-notice">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || agent === undefined" class="soft">Loading #{{ id }}…</p>
    <p v-else-if="agent === null" class="soft">No agent #{{ id }} on {{ chain.name }}.</p>
    <template v-else>
      <div class="i-head">
        <Sigil :seed="`${chain.chainId}:${agent.tokenId}`" :image="file?.image" :size="52" />
        <div style="min-width: 0; flex: 1">
          <h1>{{ file === undefined ? '…' : name }}</h1>
          <span class="soft mono" style="margin-right: 8px">{{ chain.chainId }}:{{ agent.tokenId }}</span>
          <span v-if="file?.active === true" class="i-chip ok">active</span><span v-else-if="file?.active === false" class="i-chip">inactive</span>
          <span v-if="file?.x402Support" class="i-chip">x402</span>
          <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a>
        </div>
        <div v-if="agent.feedback.length" style="text-align: right">
          <b style="font-size: 28px">{{ grade }}</b><br /><span class="i-chip" :class="TONE[stats?.level ?? 'clean']">{{ stats?.level }}</span>
        </div>
      </div>
      <nav class="i-tabs">
        <button v-for="t in (['overview', 'feedback', 'reviewers', 'file'] as Tab[])" :key="t" :class="{ on: tab === t }" @click="tab = t">
          {{ { overview: 'Overview', feedback: `Feedback ${agent.feedback.length}`, reviewers: `Reviewers ${stats?.reviewers.length ?? 0}`, file: 'Identity' }[t] }}
        </button>
      </nav>

      <template v-if="tab === 'overview'">
        <p v-if="file?.description" style="margin: 0 0 10px">{{ file.description }}</p>
        <template v-if="report && stats && scores && agent.feedback.length">
          <p style="margin: 0"><b>{{ report.headline }}</b></p>
          <div class="i-kpis">
            <div><small>Trusted</small><b>{{ formatNumber(report.trusted) }}</b></div>
            <div><small>Raw</small><b>{{ formatNumber(report.raw) }}</b></div>
            <div><small>95% bound</small><b>{{ formatNumber(report.lcb) }}</b></div>
            <div><small>Evidence</small><b style="font-size: 15px">{{ report.strength.tier }}</b></div>
            <div><small>Voices (1/HHI)</small><b>{{ formatNumber(effectiveCount(stats.reviewers.map((r) => r.rows))) }}</b></div>
            <div><small>Momentum</small><b>{{ formatSigned(scores.momentum) }}</b></div>
            <div><small>8004scan</small><b>{{ scan.data.value ? formatNumber(scan.data.value.total) : '—' }}</b></div>
            <div><small>Ecosystem</small><b>{{ formatNumber(ecosystem.data.value?.averageFeedback) }}</b></div>
          </div>
          <svg v-if="trend" viewBox="0 0 220 44" style="width: 100%; max-width: 440px; height: 60px" aria-label="Running average"><path :d="trend" fill="none" stroke="#2f5bd3" stroke-width="2" /></svg>
          <section class="i-sec">
            <h3>Signals</h3>
            <p v-for="s in stats.signals" :key="s.code" style="margin: 0 0 4px"><span class="i-chip" :class="TONE[s.level]">{{ s.level }}</span>{{ s.text }}</p>
            <p v-if="!stats.signals.length" class="soft">None.</p>
          </section>
          <section class="i-sec">
            <h3>Score build</h3>
            <div class="i-rows">
              <div v-for="s in report.waterfall" :key="s.id" class="i-row" style="cursor: default" :title="s.rule"><span>{{ s.label }}</span><b>{{ formatNumber(s.average) }}</b><span class="soft">{{ s.id === 'all' ? '' : formatSigned(s.delta) }}</span></div>
            </div>
          </section>
        </template>
        <p v-else class="soft">No feedback yet.</p>
      </template>

      <template v-else-if="tab === 'feedback'">
        <p v-if="reviewerFilter" class="soft">Only <span class="mono">{{ shortAddress(reviewerFilter) }}</span> · <a href="#" @click.prevent="reviewerFilter = undefined">show all</a></p>
        <p v-if="agent.feedbackSince" class="soft">Dated from {{ formatDate(agent.feedbackSince) }}. Select a row to open its tx detail below.</p>
        <div class="i-rows">
          <div v-for="r in rows" :key="r.index" class="i-row" :class="{ on: drawer === r.index, revoked: r.row.revoked }" @click="drawer = drawer === r.index ? undefined : r.index">
            <span style="min-width: 0">
              <span class="mono">{{ shortAddress(r.row.client) }}</span>
              <span v-for="f in flags(stats?.rows[r.index]?.flags ?? [])" :key="f" class="i-chip warn">{{ f }}</span>
              <span v-if="r.row.tag1" class="i-chip">{{ r.row.tag1 }}</span>
              <FeedbackNote v-if="r.row.feedbackURI" :uri="r.row.feedbackURI" />
            </span>
            <b>{{ formatScore(r.row.value) }}</b>
            <span class="soft">{{ r.row.createdAt ? formatTimeline(r.row.createdAt) : '' }}</span>
          </div>
        </div>
      </template>

      <template v-else-if="tab === 'reviewers' && stats">
        <div class="i-rows">
          <div v-for="r in stats.reviewers" :key="r.client" class="i-row" @click="reviewerFilter = r.client.toLowerCase(); tab = 'feedback'">
            <span><RouterLink :to="to.reviewer(r.client)" class="mono" @click.stop>{{ shortAddress(r.client) }}</RouterLink> <span v-for="f in flags(r.flags)" :key="f" class="i-chip warn">{{ f }}</span></span>
            <span>{{ r.rows }} · avg {{ formatNumber(r.average) }}</span>
            <span class="soft">{{ formatPercent(r.share) }}</span>
          </div>
        </div>
        <p class="soft">Click a reviewer to filter its feedback; the address opens its profile.</p>
      </template>

      <template v-else>
        <dl class="i-props">
          <dt>Owner</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">{{ agent.owner }}</RouterLink><span v-else class="soft">—</span></dd>
          <dt>Agent wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentWallet }}</a><span v-else class="soft">not set</span><span v-if="walletIsOwner" class="soft"> · same as owner</span></dd>
          <dt>Agent URI</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentURI }}</a><span v-else class="soft mono">{{ agent.agentURI ?? 'not set' }}</span></dd>
          <dt>Registry</dt><dd><a :href="addressExplorerUrl(chain, chain.identity)" target="_blank" rel="noopener noreferrer" class="mono">{{ chain.identity }}</a></dd>
          <dt v-if="agent.createdAt">Registered</dt><dd v-if="agent.createdAt">{{ formatDate(agent.createdAt) }}</dd>
          <dt>Trust models</dt><dd>{{ file?.supportedTrust.join(', ') || '—' }}</dd>
          <template v-for="s in file?.services ?? []" :key="s.name + s.endpoint"><dt><span class="i-chip">{{ s.name }}</span></dt><dd class="mono" :title="s.endpoint">{{ s.endpoint }}<span v-if="s.version" class="soft"> v{{ s.version }}</span></dd></template>
        </dl>
        <pre v-if="rawJson" style="margin-top: 12px">{{ rawJson }}</pre>
      </template>
    </template>
  </div>
  <div v-if="drawer !== undefined && agent && stats && agent.feedback[drawer]" class="i-drawer">
    <p style="margin: 0 0 6px; display: flex; justify-content: space-between">
      <span>Row {{ drawer }} · <span class="mono">{{ shortAddress(agent.feedback[drawer].client) }}</span> · {{ formatScore(agent.feedback[drawer].value) }}<a v-if="agent.feedback[drawer].txHash" :href="txExplorerUrl(chain, agent.feedback[drawer].txHash!)" target="_blank" rel="noopener noreferrer"> tx ↗</a></span>
      <button @click="drawer = undefined">Close · Esc</button>
    </p>
    <TxPanel :chain="chain" :agent="agent" :row="agent.feedback[drawer]" :index="drawer" :stats="stats" />
  </div>
</template>
