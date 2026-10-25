<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { effectiveCount, letterGrade, runningAverage, sparkPath100, velocity } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import Heat from './Heat.vue'
import Ring from './Ring.vue'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const LEVEL_CLASS: Record<string, string> = { high: 'bad', warn: 'warn', info: '', clean: 'good' }
const trend = computed(() => sparkPath100(runningAverage(agent.value?.feedback ?? []).map((p) => p.average), 260, 70))
const DONUT = ['#6d5dfc', '#18b39a', '#ff8a3d', '#ef4b6c', '#9aa0ad']
const donut = computed(() => {
  const rs = stats.value?.reviewers ?? []
  const top = rs.slice(0, 4).map((r) => ({ label: shortAddress(r.client), share: r.share, client: r.client as string | undefined }))
  const rest = 1 - top.reduce((a, r) => a + r.share, 0)
  if (rest > 0.001) top.push({ label: `${rs.length - 4} others`, share: rest, client: undefined })
  let acc = 0
  return top.map((s, i) => {
    const seg = { ...s, color: DONUT[i], dash: `${s.share * 264} 264`, offset: -acc * 264 }
    acc += s.share
    return seg
  })
})
const open = ref<number>()
function flagList(f: RowFlag[]): string[] {
  return f.filter((x) => x !== 'revoked').map((x) => FLAG_INFO[x].label)
}
</script>

<template>
  <p v-if="error" class="b-notice">Could not load agent: {{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="soft">Loading agent…</p>
  <section v-else-if="agent === null" class="b-card"><h3>Not found</h3><p class="b-mid">No agent #{{ id }} on {{ chain.name }}.</p></section>
  <div v-else class="b-grid">
    <section class="b-card s8 b-row" style="align-items: flex-start; gap: 18px">
      <Sigil :seed="`${chain.chainId}:${agent.tokenId}`" :image="file?.image" :size="88" />
      <div style="min-width: 0; flex: 1">
        <p class="soft b-mono"><RouterLink :to="to.agents()">Agents</RouterLink> / {{ chain.chainId }}:{{ agent.tokenId }}</p>
        <h1 class="b-mid" style="margin: 2px 0 6px">{{ file === undefined ? '…' : name }}</h1>
        <p class="soft" style="margin: 0 0 10px">{{ file?.description ?? (file === null ? 'Registration file unreachable — on-chain data only.' : '') }}</p>
        <span v-if="file?.active === true" class="b-pill good">active</span>
        <span v-else-if="file?.active === false" class="b-pill">inactive</span>
        <span v-if="file?.x402Support" class="b-pill">x402</span>
        <span v-for="t in file?.supportedTrust ?? []" :key="t" class="b-pill">{{ t }}</span>
        <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer" class="b-pill">8004scan ↗</a>
      </div>
    </section>
    <section class="b-card s4 b-dark" style="text-align: center">
      <h3>Grade</h3>
      <p style="font-size: 76px; font-weight: 900; line-height: 1; margin: 6px 0">{{ grade }}</p>
      <p class="soft" style="margin: 0">{{ report?.strength.tier ?? '—' }} evidence · <span :class="LEVEL_CLASS[stats?.level ?? 'clean']">{{ stats?.level ?? '—' }}</span></p>
    </section>

    <template v-if="agent.feedback.length && report && stats && scores">
      <section class="b-card s4" style="display: flex; gap: 14px; align-items: center">
        <Ring :value="report.trusted" :ghost="report.raw" label="trusted" :size="130" />
        <div>
          <h3 style="margin-bottom: 4px">Trusted vs raw</h3>
          <p class="b-mid">{{ formatNumber(report.trusted) }} <span class="soft" style="font-size: 16px">/ {{ formatNumber(report.raw) }}</span></p>
          <p class="soft" style="margin: 4px 0 0">95% bound {{ formatNumber(report.lcb) }}<br />8004scan {{ scan.data.value ? formatNumber(scan.data.value.total) : '—' }} · eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</p>
        </div>
      </section>
      <section class="b-card s4">
        <h3>Running average</h3>
        <svg viewBox="0 0 260 74" style="width: 100%; height: 90px" preserveAspectRatio="none" aria-label="Running average">
          <path v-if="trend" :d="`${trend} L260,74 L0,74 Z`" fill="#6d5dfc" fill-opacity=".12" />
          <path v-if="trend" :d="trend" fill="none" stroke="#6d5dfc" stroke-width="2.5" />
        </svg>
        <p class="soft" style="margin: 0">momentum {{ formatSigned(scores.momentum) }} · {{ formatNumber(velocity(agent.feedback.map((f) => f.createdAt))) }} feedback/day</p>
      </section>
      <section class="b-card s4">
        <h3>Who speaks</h3>
        <div class="b-row">
          <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
            <circle v-for="s in donut" :key="s.label" cx="50" cy="50" r="42" fill="none" :stroke="s.color" stroke-width="14" :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset" transform="rotate(-90 50 50)" />
            <text x="50" y="55" text-anchor="middle" font-size="18" font-weight="800">{{ stats.reviewers.length }}</text>
          </svg>
          <ul class="b-list" style="flex: 1; font-size: 12px">
            <li v-for="s in donut" :key="s.label" style="padding: 3px 0; border: 0">
              <i :style="{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flex: 'none' }" />
              <RouterLink v-if="s.client" :to="to.reviewer(s.client)" class="grow b-mono">{{ s.label }}</RouterLink>
              <span v-else class="grow soft">{{ s.label }}</span>
              <b>{{ formatPercent(s.share) }}</b>
            </li>
          </ul>
        </div>
        <p class="soft" style="margin: 6px 0 0">≈ {{ formatNumber(effectiveCount(stats.reviewers.map((r) => r.rows))) }} independent voices</p>
      </section>

      <section class="b-card s5 b-tint">
        <h3>What stands out</h3>
        <p style="font-weight: 700; margin: 0 0 10px">{{ report.headline }}</p>
        <ul class="b-list">
          <li v-for="s in stats.signals" :key="s.code"><span class="b-pill" :class="s.level === 'high' ? 'bad' : s.level === 'warn' ? 'warn' : ''">{{ s.level }}</span><span>{{ s.text }}</span></li>
          <li v-if="!stats.signals.length" class="good">No warning signs.</li>
        </ul>
      </section>
      <section class="b-card s4">
        <h3>Score, rule by rule</h3>
        <div v-for="s in report.waterfall" :key="s.id" :title="s.rule" style="margin-bottom: 8px">
          <div class="b-row" style="justify-content: space-between; font-size: 12px"><span>{{ s.label }}</span><b>{{ formatNumber(s.average) }} <span class="soft">{{ s.id === 'all' ? '' : formatSigned(s.delta) }}</span></b></div>
          <div class="b-meter"><i :style="{ width: `${Math.max(0, Math.min(100, s.average ?? 0))}%`, background: s.id === 'all' ? '#9aa0ad' : '#6d5dfc' }" /></div>
        </div>
      </section>
      <section class="b-card s3">
        <h3>Quality</h3>
        <p class="b-mid">{{ formatPercent(scores.trustMass) }}</p><p class="soft" style="margin: 0 0 10px">of votes count fully</p>
        <p class="b-mid">{{ formatNumber(scores.polarization, 2) }}</p><p class="soft" style="margin: 0 0 10px">polarization (0 united)</p>
        <p class="b-mid">{{ formatNumber(scores.median) }}</p><p class="soft" style="margin: 0">median</p>
      </section>
      <section class="b-card s6"><h3>When feedback arrives</h3><Heat :times="agent.feedback.map((f) => f.createdAt)" /></section>
      <section class="b-card s6">
        <h3>Identity</h3>
        <ul class="b-list">
          <li><span class="soft">Owner</span><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="grow b-mono" style="text-align: right">{{ agent.owner }}</RouterLink></li>
          <li><span class="soft">Wallet</span><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="grow b-mono" style="text-align: right">{{ agent.agentWallet }}</a><span v-else class="grow soft" style="text-align: right">not set</span><span v-if="walletIsOwner" class="b-pill">= owner</span></li>
          <li><span class="soft">URI</span><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" class="grow b-mono" style="text-align: right">{{ agent.agentURI }}</a><span v-else class="grow soft" style="text-align: right">{{ agent.agentURI ?? 'not set' }}</span></li>
          <li v-if="agent.createdAt"><span class="soft">Registered</span><span class="grow" style="text-align: right">{{ formatDate(agent.createdAt) }}</span></li>
          <li v-for="s in file?.services ?? []" :key="s.name + s.endpoint"><span class="b-pill">{{ s.name }}</span><span class="grow b-mono" style="text-align: right">{{ s.endpoint }}</span></li>
        </ul>
      </section>

      <section class="b-card s12">
        <h3>Feedback · {{ agent.feedback.length }}<template v-if="agent.feedbackSince"> · dated since {{ formatDate(agent.feedbackSince) }}</template></h3>
        <div class="b-feed">
          <div v-for="(row, i) in agent.feedback" :key="i" class="b-fb" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
            <div class="b-row">
              <span class="val">{{ formatScore(row.value) }}</span>
              <div style="flex: 1; min-width: 0">
                <RouterLink :to="to.reviewer(row.client)" class="b-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
                <span class="soft"> · {{ row.createdAt ? formatTimeline(row.createdAt) : 'undated' }} · weight {{ formatNumber(stats.rows[i]?.weight, 2) }}</span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
              </div>
              <span v-for="f in flagList(stats.rows[i]?.flags ?? [])" :key="f" class="b-pill warn">{{ f }}</span>
              <span v-if="row.tag1" class="b-pill">{{ row.tag1 }}</span>
              <span v-if="row.revoked" class="b-pill bad">revoked</span>
            </div>
            <TxPanel v-if="open === i" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" @click.stop />
          </div>
        </div>
      </section>
    </template>
    <section v-else class="b-card s12"><h3>Reputation</h3><p class="soft">No feedback yet. Nothing to score.</p></section>
    <section v-if="rawJson" class="b-card s12"><details><summary><b>Raw registration file</b></summary><pre>{{ rawJson }}</pre></details></section>
  </div>
</template>
