<script setup lang="ts">
import { ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import { formatDate, formatNumber, formatScore, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'

// Swiss keeps four numbers: trusted, raw, reviewers, and the gap between them.
const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, name, uriLink, rawJson, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
</script>

<template>
  <p v-if="error" class="w-red">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="w-hero soft">…</p>
  <template v-else-if="agent === null"><p class="w-hero w-red">404</p><p class="w-sentence">No agent {{ id }} on {{ chain.name }}.</p></template>
  <template v-else>
    <div class="w-grid" style="margin-top: 36px">
      <div style="grid-column: span 8">
        <p class="w-label"><RouterLink :to="to.agents()">Agents</RouterLink> / {{ agent.tokenId }}</p>
        <h1 class="w-h" style="margin-top: 10px">{{ file === undefined ? '…' : name }}</h1>
        <p class="w-sentence" style="font-weight: 500">{{ file?.description ?? '' }}</p>
      </div>
      <div style="grid-column: span 4; padding-top: 40px; font-size: 14px">
        <p style="margin: 0 0 6px"><span class="w-label">Owner</span><br /><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">{{ agent.owner }}</RouterLink></p>
        <p style="margin: 0 0 6px"><span class="w-label">Wallet</span><br /><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentWallet }}</a><span v-else class="soft">—</span></p>
        <p style="margin: 0 0 6px"><span class="w-label">File</span><br /><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentURI }}</a><span v-else class="soft">{{ agent.agentURI ? 'inline' : '—' }}</span></p>
        <p style="margin: 0 0 6px"><span class="w-label">Registered</span><br />{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</p>
        <p style="margin: 0"><span v-for="s in file?.services ?? []" :key="s.name + s.endpoint" :title="s.endpoint">{{ s.name }}&emsp;</span><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan</a></p>
      </div>
    </div>

    <template v-if="report && stats && agent.feedback.length">
      <div class="w-grid">
        <div class="w-cell" style="grid-column: span 6">
          <span class="w-label">Trusted</span>
          <p class="w-hero" :class="{ 'w-red': stats.level === 'high' }" style="margin: 10px 0 0">{{ formatNumber(report.trusted) }}</p>
        </div>
        <div class="w-cell" style="grid-column: span 2"><span class="w-label">Raw</span><p class="w-big">{{ formatNumber(report.raw) }}</p></div>
        <div class="w-cell" style="grid-column: span 2"><span class="w-label">Gap</span><p class="w-big" :class="{ 'w-red': (report.raw ?? 0) - (report.trusted ?? 0) > 5 }">{{ report.raw !== null && report.trusted !== null ? formatNumber(report.raw - report.trusted) : '—' }}</p></div>
        <div class="w-cell" style="grid-column: span 2"><span class="w-label">Reviewers</span><p class="w-big">{{ stats.reviewers.length }}</p></div>
      </div>
      <p class="w-sentence">{{ report.headline }}</p>
      <p v-for="s in stats.signals" :key="s.code" style="margin: 0 0 6px; max-width: 70ch"><b :class="{ 'w-red': s.level !== 'info' }">{{ s.level }}</b>&emsp;{{ s.text }}</p>

      <h2 class="w-h">Reviews</h2>
      <p v-if="agent.feedbackSince" class="soft">Dated from {{ formatDate(agent.feedbackSince) }}.</p>
      <div class="w-row head"><span>Text</span><span>Reviewer</span><span class="r">Value</span><span class="r">Weight</span><span class="r">When</span></div>
      <template v-for="(row, i) in agent.feedback" :key="i">
        <div class="w-row click" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
          <span><FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" /><span v-else class="soft">{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || '—' }}</span></span>
          <span><RouterLink :to="to.reviewer(row.client)" class="mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink></span>
          <span class="r"><b>{{ formatScore(row.value) }}</b></span>
          <span class="r" :class="{ 'w-red': (stats.rows[i]?.weight ?? 1) < 1 }">{{ formatNumber(stats.rows[i]?.weight, 2) }}</span>
          <span class="r soft">{{ row.createdAt ? formatTimeline(row.createdAt) : '' }}</span>
        </div>
        <TxPanel v-if="open === i" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
      </template>
    </template>
    <p v-else class="w-sentence soft">No reviews.</p>
    <details v-if="rawJson" style="margin-top: 40px"><summary class="w-label">Registration file</summary><pre>{{ rawJson }}</pre></details>
  </template>
</template>
