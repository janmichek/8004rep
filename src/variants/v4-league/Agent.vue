<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { activeDays, rankScore } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { record, resultOf, tierOf } from './league'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

const fb = computed(() => agent.value?.feedback ?? [])
const wdl = computed(() => record(fb.value))
const pts = computed(() => rankScore(agent.value?.reputation ?? (report.value?.raw != null ? { count: fb.value.length, average: report.value.raw } : undefined), ecosystem.data.value?.averageFeedback ?? 50))
const tier = computed(() => tierOf(pts.value, fb.value.length))
// Newest ten, newest last — the way a form guide reads.
const form = computed(() =>
  [...fb.value]
    .filter((f) => f.createdAt !== undefined)
    .sort((a, b) => a.createdAt! - b.createdAt!)
    .slice(-10),
)
// Referee bias: how far each reviewer's average sits from the agent's raw average.
const refs = computed(() =>
  (stats.value?.reviewers ?? []).map((r) => ({ ...r, bias: r.average !== null && report.value?.raw != null ? r.average - report.value.raw : null })),
)
const open = ref<number>()
function flags(f: RowFlag[]): string[] {
  return f.filter((x) => x !== 'revoked').map((x) => FLAG_INFO[x].label)
}
</script>

<template>
  <p><RouterLink :to="to.agents()" class="soft">← Standings</RouterLink></p>
  <p v-if="error" class="g-notice">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="soft">Loading player…</p>
  <h1 v-else-if="agent === null" class="g-title"><small>Not found</small>No player #{{ id }}</h1>
  <template v-else>
    <section class="g-card" :data-num="agent.tokenId.toString()">
      <div style="text-align: center">
        <Sigil :seed="`${chain.chainId}:${agent.tokenId}`" :image="file?.image" :size="160" :palette="['#d7ff3a', '#2fd27a', '#4a63d9', '#ff4f6d', '#111c45']" />
        <p style="margin: 8px 0 0"><span class="g-tier" :class="tier">{{ tier }}</span></p>
      </div>
      <div style="position: relative; z-index: 1; min-width: 0">
        <h1 class="g-title"><small>#{{ agent.tokenId }} · {{ chain.name }}<template v-if="file?.active === false"> · inactive</template></small>{{ file === undefined ? '…' : name }}</h1>
        <p class="soft" style="max-width: 70ch">{{ file?.description ?? (file === null ? 'No registration file on record.' : '') }}</p>
        <div v-if="form.length" style="display: flex; gap: 10px; align-items: center">
          <span class="soft" style="font: 700 12px var(--cond); text-transform: uppercase">Form</span>
          <span class="g-form"><i v-for="(f, i) in form" :key="i" :class="resultOf(f)" :title="`${formatScore(f.value)} · ${f.createdAt ? formatDate(f.createdAt) : ''}`">{{ resultOf(f) }}</i></span>
        </div>
        <div class="g-stats">
          <div class="g-stat"><b class="volt">{{ formatNumber(pts) }}</b><small>Points</small></div>
          <div class="g-stat"><b>{{ formatNumber(report?.trusted) }}</b><small>Trusted</small></div>
          <div class="g-stat"><b>{{ wdl.W }}-{{ wdl.D }}-{{ wdl.L }}</b><small>W-D-L</small></div>
          <div class="g-stat"><b>{{ fb.length }}</b><small>Played</small></div>
          <div class="g-stat"><b>{{ activeDays(fb.map((f) => f.createdAt)).days }}</b><small>Matchdays</small></div>
          <div class="g-stat"><b>{{ formatSigned(scores?.momentum) }}</b><small>Momentum</small></div>
          <div class="g-stat"><b>{{ scan.data.value ? formatNumber(scan.data.value.total) : '–' }}</b><small>8004scan</small></div>
        </div>
      </div>
    </section>

    <div v-if="fb.length && stats && report" class="g-two">
      <section class="g-panel">
        <h3>Match log</h3>
        <p v-if="agent.feedbackSince" class="soft" style="margin-top: -6px">Dated back to {{ formatDate(agent.feedbackSince) }}. Click a match for the VAR review.</p>
        <div class="g-scroll">
          <table class="g-table">
            <thead><tr><th></th><th class="num">Score</th><th>Referee</th><th>Cards</th><th>Report</th><th>When</th></tr></thead>
            <tbody>
              <template v-for="(row, i) in fb" :key="i">
                <tr :class="{ revoked: row.revoked }" style="cursor: pointer" @click="open = open === i ? undefined : i">
                  <td><span class="g-form"><i :class="resultOf(row)">{{ resultOf(row) }}</i></span></td>
                  <td class="num g-pts" style="color: var(--ink)">{{ formatScore(row.value) }}</td>
                  <td><RouterLink :to="to.reviewer(row.client)" class="mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink></td>
                  <td><span v-for="f in flags(stats.rows[i]?.flags ?? [])" :key="f" class="g-chip yellow">{{ f }}</span><span v-if="stats.rows[i]?.weight === 0" class="g-chip red">void</span></td>
                  <td><FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" /></td>
                  <td class="soft">{{ row.createdAt ? formatTimeline(row.createdAt) : '–' }}</td>
                </tr>
                <tr v-if="open === i"><td colspan="6"><TxPanel :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" /></td></tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
      <div>
        <section class="g-panel">
          <h3>Verdict</h3>
          <p style="margin: 0 0 8px"><b>{{ report.headline }}</b></p>
          <p v-for="s in stats.signals" :key="s.code" style="margin: 4px 0"><span class="g-chip" :class="s.level === 'high' ? 'red' : s.level === 'warn' ? 'yellow' : ''">{{ s.level }}</span>{{ s.text }}</p>
        </section>
        <section class="g-panel">
          <h3>Referees</h3>
          <table class="g-table">
            <thead><tr><th>Ref</th><th class="num">Games</th><th class="num" title="Reviewer's average minus the agent's raw average">Bias</th><th class="num">Share</th></tr></thead>
            <tbody>
              <tr v-for="r in refs.slice(0, 12)" :key="r.client">
                <td><RouterLink :to="to.reviewer(r.client)" class="mono">{{ shortAddress(r.client) }}</RouterLink></td>
                <td class="num">{{ r.rows }}</td>
                <td class="num" :style="{ color: (r.bias ?? 0) > 5 ? 'var(--win)' : (r.bias ?? 0) < -5 ? 'var(--loss)' : '' }">{{ formatSigned(r.bias) }}</td>
                <td class="num">{{ formatPercent(r.share) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section class="g-panel">
          <h3>Scoring breakdown</h3>
          <table class="g-table">
            <tbody><tr v-for="s in report.waterfall" :key="s.id" :title="s.rule"><td>{{ s.label }}</td><td class="num">{{ formatNumber(s.average) }}</td><td class="num soft">{{ s.id === 'all' ? '' : formatSigned(s.delta) }}</td></tr></tbody>
          </table>
        </section>
      </div>
    </div>
    <section v-else class="g-panel"><h3>Season</h3><p class="soft">Hasn't played a match yet.</p></section>

    <section class="g-panel">
      <h3>Club & kit</h3>
      <p style="margin: 2px 0">Club (owner): <RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">{{ agent.owner }}</RouterLink></p>
      <p style="margin: 2px 0">Wallet: <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentWallet }}</a><span v-else class="soft">not set</span><span v-if="walletIsOwner" class="soft"> (club's own)</span></p>
      <p style="margin: 2px 0">Registration: <a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentURI }}</a><span v-else class="soft mono">{{ agent.agentURI ?? 'not set' }}</span><template v-if="agent.createdAt"> · signed {{ formatDate(agent.createdAt) }}</template></p>
      <p style="margin: 6px 0 0"><span v-for="s in file?.services ?? []" :key="s.name + s.endpoint" class="g-chip" :title="s.endpoint">{{ s.name }}</span><span v-if="file?.x402Support" class="g-chip green">x402</span><span v-for="t in file?.supportedTrust ?? []" :key="t" class="g-chip">{{ t }}</span></p>
      <p style="margin: 6px 0 0"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer" class="volt">8004scan ↗</a></p>
      <details v-if="rawJson"><summary class="soft">Contract (raw file)</summary><pre>{{ rawJson }}</pre></details>
    </section>
  </template>
</template>
