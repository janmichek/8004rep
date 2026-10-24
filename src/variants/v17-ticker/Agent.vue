<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { candles, stdDev } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { pctOf, ratingOf, symbolOf } from './market'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()

const sym = computed(() => symbolOf(file.value?.name, props.id))
const rating = computed(() => ratingOf(report.value?.trusted))
const changes = computed(() => {
  const raw = report.value?.raw
  const trusted = report.value?.trusted
  return { abs: raw !== null && raw !== undefined && trusted !== null && trusted !== undefined ? trusted - raw : null, pct: pctOf(raw, trusted) }
})
const volatility = computed(() => stdDev(agent.value?.feedback.filter((f) => !f.revoked).map((f) => f.value) ?? []))
const days = computed(() => candles(agent.value?.feedback ?? []))
const chart = computed(() => {
  const rows = days.value
  const w = 880
  const h = 250
  const left = 34
  const right = 10
  const top = 12
  const bottom = 20
  const plotW = w - left - right
  const plotH = h - top - bottom
  const step = plotW / Math.max(1, rows.length)
  const y = (v: number) => top + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH
  const body = Math.max(2, Math.min(14, step * 0.55))
  const bars = rows.map((d, i) => {
    const cx = left + step * (i + 0.5)
    const up = d.close >= d.open
    return { ...d, cx, up, body, yOpen: y(d.open), yClose: y(d.close), yHigh: y(d.high), yLow: y(d.low), x: cx - body / 2 }
  })
  return { w, h, left, right, top, bottom, plotW, plotH, step, y, bars }
})
const book = computed(() => {
  const last = report.value?.trusted ?? null
  const rows = [...(stats.value?.reviewers ?? [])].sort((a, b) => (b.weightShare ?? 0) - (a.weightShare ?? 0))
  const peak = Math.max(0.0001, ...rows.map((r) => r.weightShare ?? 0))
  return rows.slice(0, 14).map((r) => ({
    ...r,
    side: last !== null && r.average !== null && r.average >= last ? 'bid' : 'ask',
    width: ((r.weightShare ?? 0) / peak) * 100,
  }))
})
</script>

<template>
  <p v-if="error" class="t-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="t-empty">LOADING TAPE…</p>
  <template v-else-if="agent === null">
    <p class="t-kicker">NOT LISTED</p>
    <h1 class="t-h1">Agent {{ id }} is not on this venue.</h1>
  </template>
  <template v-else>
    <p class="t-kicker"><RouterLink :to="to.agents()">LISTINGS</RouterLink> / {{ sym }}</p>
    <div class="t-quote">
      <div>
        <div class="sym">{{ sym }} <span class="t-dim">· #{{ agent.tokenId }}</span></div>
        <div class="px">{{ formatNumber(report?.trusted) }}<small> / 100</small></div>
        <div :class="changes.abs === null ? 't-dim' : changes.abs >= 0 ? 't-up' : 't-down'">
          {{ changes.abs === null ? '—' : formatSigned(changes.abs) }}
          <span class="t-dim">vs raw {{ formatNumber(report?.raw) }}<template v-if="changes.pct !== null"> ({{ formatSigned(changes.pct) }}%)</template></span>
        </div>
      </div>
      <div class="t-bidask">
        <div><span class="t-dim">GRADE</span> <span class="t-badge" :class="{ info: rating.startsWith('A'), hot: rating === 'D' }">{{ rating }}</span></div>
        <div><span class="t-dim">VOL</span> {{ stats?.coverage.total ?? 0 }} <span class="t-dim">/ FULL</span> {{ formatNumber(scores?.effectiveCount) }}</div>
        <div><span class="t-dim">VOLATILITY</span> {{ formatNumber(volatility) }}</div>
        <div><span class="t-dim">PARTICIPANTS</span> {{ stats?.reviewers.length ?? 0 }}</div>
      </div>
    </div>

    <h2 class="t-h2">Daily tape · open / high / low / close ({{ days.length }} sessions)</h2>
    <p v-if="!days.length" class="t-empty">No dated ratings: draw no candles rather than invent a tape.</p>
    <svg v-else class="t-chart" :viewBox="`0 0 ${chart.w} ${chart.h}`" role="img" aria-label="Daily candle chart of review values">
      <g v-for="v in [0, 25, 50, 75, 100]" :key="v">
        <line :x1="chart.left" :y1="chart.y(v)" :x2="chart.w - chart.right" :y2="chart.y(v)" class="t-verse" />
        <text :x="chart.left - 6" :y="chart.y(v) + 3" text-anchor="end" class="t-verse-label">{{ v }}</text>
      </g>
      <g v-for="b in chart.bars" :key="b.day">
        <line :x1="b.cx" :y1="b.yHigh" :x2="b.cx" :y2="b.yLow" :class="b.up ? 't-candle-up' : 't-candle-down'" stroke-width="1" />
        <rect
          :x="b.x"
          :y="Math.min(b.yOpen, b.yClose)"
          :width="b.body"
          :height="Math.max(1, Math.abs(b.yClose - b.yOpen))"
          :class="b.up ? 't-candle-up' : 't-candle-down'"
          opacity=".85"
        >
          <title>{{ formatDate(b.day) }} · O {{ b.open }} H {{ b.high }} L {{ b.low }} C {{ b.close }} · {{ b.count }} trades</title>
        </rect>
      </g>
    </svg>
    <p class="t-note">Each candle is one UTC day of non-revoked ratings. High and low are the day's extremes; open and close follow arrival order.</p>

    <div class="t-columns" style="margin-top: 18px">
      <div>
        <h2 class="t-h2" style="margin-top: 0">Trade blotter</h2>
        <p v-if="!agent.feedback.length" class="t-empty">NO TRADES</p>
        <template v-else>
          <div class="t-blotter head"><span>#</span><span>Note</span><span>Participant</span><span class="num">Px</span><span class="num">Wt</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="t-blotter" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join('/') || 'BARE' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="t-dim"> ·{{ FLAG_INFO[f].label }}</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num t-dim">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </template>

        <h2 class="t-h2">Survey waterfall</h2>
        <table class="t-table">
          <thead><tr><th>Step</th><th>Rule</th><th class="num">After</th><th class="num">Δ</th><th class="num">Rows</th></tr></thead>
          <tbody>
            <tr v-for="step in report?.waterfall ?? []" :key="step.id">
              <td>{{ step.label }}</td>
              <td class="t-dim" style="white-space: normal">{{ step.rule }}</td>
              <td class="num">{{ step.average === null ? '—' : formatNumber(step.average) }}</td>
              <td class="num" :class="step.delta === null ? 't-dim' : step.delta >= 0 ? 't-up' : 't-down'">{{ step.delta === null ? '—' : formatSigned(step.delta) }}</td>
              <td class="num">{{ step.rows }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="t-side">
        <div class="t-panel">
          <h3 class="t-h3">Order book · participants</h3>
          <p class="t-note">Bids sit at or above the last price; asks below. The bar is the participant's share of authenticity weight.</p>
          <p v-if="!book.length" class="t-empty">No participants.</p>
          <div v-else class="t-book">
            <span class="head">Participant</span><span class="head">Mean</span><span class="head">Share</span>
            <template v-for="b in book" :key="b.client">
              <RouterLink :to="to.reviewer(b.client)" class="t-mono">{{ shortAddress(b.client) }}</RouterLink>
              <span :class="b.side === 'bid' ? 't-up' : 't-down'">{{ formatNumber(b.average) }}</span>
              <span class="bar" :class="{ ask: b.side === 'ask' }" :style="{ width: `${Math.max(3, b.width)}%` }" />
            </template>
          </div>
          <p class="t-note">{{ formatPercent(scores?.trustMass) }} of raw volume survives the weights.</p>
        </div>
        <div class="t-panel">
          <h3 class="t-h3">Listing data</h3>
          <table class="t-table">
            <tbody>
              <tr><td class="t-dim">Owner</td><td><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ shortAddress(agent.owner) }}</RouterLink><span v-else>—</span></td></tr>
              <tr><td class="t-dim">Wallet</td><td><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (OWNER)' : '' }}</td></tr>
              <tr><td class="t-dim">Listed</td><td>{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</td></tr>
              <tr><td class="t-dim">Services</td><td style="white-space: normal">{{ file?.services.map((s) => s.name).join(', ') || '—' }}</td></tr>
              <tr><td class="t-dim">Trust</td><td style="white-space: normal">{{ file?.supportedTrust.join(', ') || '—' }}</td></tr>
              <tr><td class="t-dim">LCB</td><td>{{ formatNumber(report?.lcb) }}</td></tr>
              <tr><td class="t-dim">Spread</td><td>{{ formatNumber(report?.raw) }} → {{ formatNumber(report?.trusted) }}</td></tr>
            </tbody>
          </table>
          <p class="t-note"><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">REGISTRATION FILE ↗</a><span v-else class="t-dim">INLINE FILE</span> · <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004SCAN ↗</a></p>
          <details v-if="rawJson"><summary class="t-kicker">RAW JSON</summary><pre>{{ rawJson }}</pre></details>
        </div>
        <div class="t-panel">
          <h3 class="t-h3">Analyst note</h3>
          <p class="t-prose" style="font-size: 11px">{{ report?.headline ?? 'No ratings yet.' }}</p>
          <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="t-note">· {{ reason }}</p>
        </div>
      </aside>
    </div>
  </template>
</template>
