<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl, txExplorerUrl } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { activeDays, asciiBar, gini, letterGrade, runningAverage, velocity, weekHourGrid } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import Prompt from './Prompt.vue'
import { useRowCursor } from './useRows'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

const SPARK = '▁▂▃▄▅▆▇█'
function spark(values: number[]): string {
  if (!values.length) return ''
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return values.map((v) => SPARK[Math.round(((v - lo) / (hi - lo || 1)) * 7)]).join('')
}
const HEAT = ' ·░▒▓█'
const heat = computed(() => {
  const grid = weekHourGrid(agent.value?.feedback.map((f) => f.createdAt) ?? [])
  const max = Math.max(1, ...grid.flat())
  return grid.map((row) => row.map((c) => (c ? HEAT[Math.max(1, Math.ceil((c / max) * 5))] : HEAT[0])).join(''))
})
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const extra = computed(() => {
  const fb = agent.value?.feedback ?? []
  const times = fb.map((f) => f.createdAt)
  const trend = runningAverage(fb)
  return {
    velocity: velocity(times),
    days: activeDays(times),
    gini: gini(stats.value?.reviewers.map((r) => r.rows) ?? []),
    spark: spark(trend.slice(-60).map((p) => p.average)),
  }
})
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))

const tab = ref<'log' | 'reviewers' | 'explain'>('log')
const open = ref<number>()
const rows = computed(() => (agent.value?.feedback ?? []).map((row, index) => ({ row, index, st: stats.value?.rows[index] })))
const cursor = useRowCursor(
  () => (tab.value === 'log' ? rows.value.length : 0),
  (i) => (open.value = open.value === i ? undefined : i),
)
function flagText(flags: RowFlag[]): string {
  return flags.map((f) => FLAG_INFO[f].label).join(' ')
}
const LEVEL: Record<string, string> = { high: 'red', warn: 'amber', info: 'cyan', clean: 'ok' }
</script>

<template>
  <p><RouterLink :to="to.agents()">cd ..</RouterLink></p>
  <pre v-if="error" class="t-err">error: {{ error }} <button @click="reload">retry</button></pre>
  <pre v-else-if="loading || agent === undefined" class="dim">reading agent {{ id }}…</pre>
  <pre v-else-if="agent === null" class="t-err">error: token {{ id }} not in the {{ chain.name }} identity registry</pre>
  <template v-else>
    <Prompt :cmd="`stat agent/${agent.tokenId}`" :busy="file === undefined">
      <h1 class="hi" style="font-size: 18px">{{ file === undefined ? '…' : name }}</h1>
      <p v-if="file?.description" class="dim" style="max-width: 90ch; margin: 2px 0 8px">{{ file.description }}</p>
      <p v-else-if="file === null" class="amber">registration file unreachable or unset; showing on-chain data</p>
      <div class="t-cols">
        <dl class="t-kv">
          <dt>id</dt><dd>{{ chain.chainId }}:{{ agent.tokenId }}</dd>
          <dt>status</dt>
          <dd>
            <span :class="file?.active ? 'ok' : 'dim'">{{ file?.active === true ? 'active' : file?.active === false ? 'inactive' : '?' }}</span>
            <span v-if="file?.x402Support" class="cyan"> x402</span>
            <span v-for="t in file?.supportedTrust ?? []" :key="t" class="dim"> {{ t }}</span>
          </dd>
          <dt>owner</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else class="dim">-</span></dd>
          <dt>wallet</dt>
          <dd>
            <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ agent.agentWallet }}</a>
            <span v-else class="dim">not set</span><span v-if="walletIsOwner" class="dim"> (= owner)</span>
          </dd>
          <dt>uri</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else class="dim">{{ agent.agentURI ?? 'not set' }}</span></dd>
          <dt v-if="agent.createdAt">born</dt><dd v-if="agent.createdAt">{{ formatDate(agent.createdAt) }}</dd>
          <dt>8004scan</dt><dd><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">open ↗</a> <span class="dim">score {{ scan.data.value ? formatNumber(scan.data.value.total) : scan.loading.value ? '…' : '-' }}</span></dd>
        </dl>
        <div>
          <pre class="dim">services:</pre>
          <pre v-if="!file?.services?.length" class="dim">  {{ file === undefined ? '…' : '(none)' }}</pre>
          <pre v-for="s in file?.services ?? []" :key="s.name + s.endpoint">  <span class="hi">{{ s.name.padEnd(8) }}</span> {{ s.endpoint }}<span v-if="s.version" class="dim"> v{{ s.version }}</span></pre>
        </div>
      </div>
    </Prompt>

    <Prompt v-if="agent.feedback.length && report && stats && scores" cmd="rep --summary">
      <div class="t-cols">
        <pre><span class="dim">grade      </span><b class="hi" style="font-size: 20px">{{ grade }}</b>
<span class="dim">trusted    </span><b class="hi">{{ formatNumber(report.trusted) }}</b> <span class="dim">{{ report.trusted === null ? '' : asciiBar(report.trusted / 100, 20) }}</span>
<span class="dim">raw        </span>{{ formatNumber(report.raw) }} <span class="dim">{{ report.raw === null ? '' : asciiBar(report.raw / 100, 20) }}</span>
<span class="dim">95% bound  </span>{{ formatNumber(report.lcb) }}
<span class="dim">median     </span>{{ formatNumber(scores.median) }}
<span class="dim">evidence   </span>{{ report.strength.tier }}
<span class="dim">risk       </span><span :class="LEVEL[stats.level]">{{ stats.level }}</span>
<span class="dim">ecosystem  </span>{{ formatNumber(ecosystem.data.value?.averageFeedback) }}</pre>
        <pre><span class="dim">reviews/day   </span>{{ formatNumber(extra.velocity) }}
<span class="dim">active days   </span>{{ extra.days.days }} <span class="dim">(streak {{ extra.days.streak }})</span>
<span class="dim">reviewer gini </span>{{ formatNumber(extra.gini, 2) }} <span class="dim">0 even · 1 one voice</span>
<span class="dim">polarization  </span>{{ formatNumber(scores.polarization, 2) }}
<span class="dim">momentum      </span>{{ formatSigned(scores.momentum) }}
<span class="dim">trust mass    </span>{{ formatPercent(scores.trustMass) }}
<span class="dim">trend         </span><span class="hi">{{ extra.spark || '-' }}</span></pre>
      </div>
      <p class="hi" style="margin: 8px 0 0">{{ report.headline }}</p>
      <pre v-for="s in stats.signals" :key="s.code"><span :class="LEVEL[s.level]">[{{ s.level.padEnd(4) }}]</span> {{ s.text }}</pre>
    </Prompt>
    <Prompt v-else cmd="rep --summary"><pre class="dim">no feedback yet. nothing to score.</pre></Prompt>

    <template v-if="agent.feedback.length && stats && report">
      <div class="t-tabs" role="tablist">
        <button v-for="t in (['log', 'reviewers', 'explain'] as const)" :key="t" role="tab" :aria-selected="tab === t" :class="{ on: tab === t }" @click="tab = t">{{ t }}</button>
      </div>

      <Prompt v-if="tab === 'log'" :cmd="`tail -n ${agent.feedback.length} feedback.log`">
        <pre v-if="agent.feedbackSince" class="dim">dated back to {{ formatDate(agent.feedbackSince) }} (log scan window)</pre>
        <div class="t-scroll">
          <table class="t-table">
            <thead><tr><th>reviewer</th><th class="num">val</th><th class="num">w</th><th>flags</th><th>tags</th><th>text</th><th>when</th><th>re</th></tr></thead>
            <tbody>
              <template v-for="(r, i) in rows" :key="r.index">
                <tr :class="{ sel: i === cursor, revoked: r.row.revoked }" style="cursor: pointer" @mouseenter="cursor = i" @click="open = open === i ? undefined : i">
                  <td><RouterLink :to="to.reviewer(r.row.client)" @click.stop>{{ shortAddress(r.row.client) }}</RouterLink></td>
                  <td class="num hi">{{ formatScore(r.row.value) }}</td>
                  <td class="num" :class="{ amber: (r.st?.weight ?? 1) < 1 }">{{ formatNumber(r.st?.weight, 2) }}</td>
                  <td class="amber">{{ flagText(r.st?.flags ?? []) }}</td>
                  <td class="dim">{{ [r.row.tag1, r.row.tag2].filter(Boolean).join(',') }}</td>
                  <td class="wrap"><FeedbackNote v-if="r.row.feedbackURI" :uri="r.row.feedbackURI" /></td>
                  <td class="dim">
                    <a v-if="r.row.txHash && r.row.createdAt" :href="txExplorerUrl(chain, r.row.txHash)" target="_blank" rel="noopener noreferrer" @click.stop>{{ formatTimeline(r.row.createdAt) }}</a>
                    <template v-else>{{ r.row.createdAt ? formatTimeline(r.row.createdAt) : '-' }}</template>
                  </td>
                  <td class="dim">{{ r.row.responses?.length || '' }}</td>
                </tr>
                <tr v-if="open === i">
                  <td colspan="8" class="wrap"><TxPanel :chain="chain" :agent="agent" :row="r.row" :index="r.index" :stats="stats" /></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <pre class="dim">j/k select · ⏎ or click: tx detail</pre>
      </Prompt>

      <Prompt v-else-if="tab === 'reviewers'" :cmd="`ls reviewers --by=share`">
        <table class="t-table">
          <thead><tr><th>reviewer</th><th class="num">n</th><th class="num">avg</th><th>share</th><th class="num" title="Raw average without this reviewer minus with it">pull</th><th>flags</th></tr></thead>
          <tbody>
            <tr v-for="r in stats.reviewers" :key="r.client">
              <td><RouterLink :to="to.reviewer(r.client)">{{ shortAddress(r.client) }}</RouterLink></td>
              <td class="num">{{ r.rows }}</td>
              <td class="num">{{ formatNumber(r.average) }}</td>
              <td><span class="dim">{{ asciiBar(r.share, 16) }}</span> {{ formatPercent(r.share) }}</td>
              <td class="num">{{ formatSigned(r.shiftWithout) }}</td>
              <td class="amber">{{ flagText(r.flags) }}</td>
            </tr>
          </tbody>
        </table>
      </Prompt>

      <template v-else>
        <Prompt cmd="rep --explain">
          <pre v-for="s in report.waterfall" :key="s.id" :title="s.rule"><span class="dim">{{ s.label.padEnd(22).slice(0, 22) }}</span> {{ formatNumber(s.average).padStart(5) }} <span class="dim">{{ s.average === null ? '' : asciiBar(s.average / 100, 24) }}</span> <span :class="(s.delta ?? 0) < 0 ? 'amber' : 'dim'">{{ s.delta === null || s.id === 'all' ? '' : formatSigned(s.delta) }}</span> <span class="dim">{{ s.id === 'all' ? '' : `${s.rows} rows` }}</span></pre>
          <pre class="dim" style="margin-top: 8px">evidence ladder:</pre>
          <pre v-for="l in report.ladder" :key="l.id" :title="l.rule">  {{ l.label.padEnd(26).slice(0, 26) }} {{ String(l.rows).padStart(4) }}</pre>
        </Prompt>
        <Prompt cmd="heatmap --utc">
          <pre class="t-grid"><span class="dim">    0     6     12    18   h</span>
<template v-for="(line, d) in heat" :key="d"><span class="dim">{{ DAYS[d] }} </span>{{ line }}
</template></pre>
        </Prompt>
      </template>
    </template>

    <Prompt v-if="rawJson" cmd="cat registration.json"><details><summary class="dim">show</summary><pre class="dim">{{ rawJson }}</pre></details></Prompt>
  </template>
</template>
