<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { histogram, labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { BAND, dialX, frequencyOf, freqText, modeOf, sMeterOf } from './radio'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const carriers = computed(() =>
  (stats.value?.topAgents ?? []).map((a) => {
    const freq = frequencyOf(a.tokenId)
    return {
      a,
      freq,
      freqText: freqText(freq),
      x: dialX(freq, 900, 26),
      height: ((a.average ?? 0) / 100) * 120,
      meter: sMeterOf(a.average),
      mode: modeOf(a.average),
    }
  }),
)
const occupancy = computed(() => histogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value), 10))
const peak = computed(() => Math.max(1, ...occupancy.value.map((b) => b.count)))
</script>

<template>
  <p class="s-kicker">SPECTRUM · {{ chain.name.toUpperCase() }}</p>
  <h1 class="s-h1">Band occupancy</h1>
  <p class="s-lede">
    {{ stats?.rows ?? '…' }} transmissions by {{ stats?.reviewers ?? '…' }} operators across {{ stats?.agents ?? '…' }} carriers.
    The plot shows the most active stations; the histogram below counts every transmission by level in the loaded window.
  </p>

  <p v-if="error" class="s-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="s-empty">SWEEPING…</p>
  <template v-else>
    <div class="s-tiles">
      <div><small>Transmissions</small><b>{{ stats.rows }}</b></div>
      <div><small>Mean level</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Full-scale</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Squelched</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="s-note">
      <template v-if="stats.from && stats.to">Window {{ formatDate(stats.from) }} → {{ formatDate(stats.to) }}. </template>
      Reference level across the wider network: {{ formatNumber(ecosystem.data.value?.averageFeedback) }}.
    </p>

    <svg class="s-dial" viewBox="0 0 900 190" role="img" aria-label="Occupancy of the most active stations">
      <line v-for="v in [0, 25, 50, 75, 100]" :key="v" :x1="26" :y1="160 - (v / 100) * 120" :x2="874" :y2="160 - (v / 100) * 120" :class="v === 0 ? 's-grat-major' : 's-grat'" />
      <text v-for="v in [0, 50, 100]" :key="`t${v}`" x="2" :y="163 - (v / 100) * 120" class="s-dial-label">{{ v }}</text>
      <text v-for="f in [88, 92, 96, 100, 104, 108]" :key="`f${f}`" :x="dialX(f, 900, 26)" y="180" text-anchor="middle" class="s-dial-label">{{ f }}</text>
      <g v-for="c in carriers" :key="c.a.tokenId.toString()">
        <RouterLink :to="to.agent(c.a.tokenId)">
          <rect :x="c.x - 3" :y="160 - c.height" width="6" :height="Math.max(1, c.height)" class="s-peak" :class="{ weak: (c.a.average ?? 0) < 40 }" opacity=".8">
            <title>{{ c.freqText }} · {{ c.a.agentName ?? `Agent ${c.a.tokenId}` }} · {{ c.a.rows }} tx · {{ formatNumber(c.a.average) }}</title>
          </rect>
        </RouterLink>
      </g>
      <text x="26" y="188" class="s-dial-label">MHz</text>
    </svg>

    <div class="s-columns" style="margin-top: 18px">
      <div>
        <h2 class="s-h2" style="margin-top: 0">Occupancy by level</h2>
        <div class="s-panel">
          <div v-for="(b, i) in occupancy" :key="i" style="display: grid; grid-template-columns: 58px 1fr 40px; gap: 8px; align-items: center; padding: 2px 0">
            <span class="soft" style="font-size: 9.5px">{{ Math.round(b.from) }}–{{ Math.round(b.to) }}</span>
            <span style="height: 9px; background: #101b25"><span :style="{ display: 'block', height: '100%', width: `${(b.count / peak) * 100}%`, background: 'var(--s-green)', opacity: .65 }" /></span>
            <span style="font-size: 9.5px; text-align: right">{{ b.count }}</span>
          </div>
        </div>

        <h2 class="s-h2">Strongest carriers</h2>
        <table class="s-table">
          <thead><tr><th>Frequency</th><th>Station</th><th>S</th><th>Mode</th><th class="num">Level</th><th class="num">Tx</th><th class="num">Ops</th></tr></thead>
          <tbody>
            <tr v-for="c in carriers" :key="c.a.tokenId.toString()">
              <td class="freq">{{ c.freqText }}</td>
              <td><RouterLink :to="to.agent(c.a.tokenId)">{{ c.a.agentName ?? `Agent ${c.a.tokenId}` }}</RouterLink></td>
              <td>{{ c.meter.label }}</td>
              <td>{{ c.mode }}</td>
              <td class="num">{{ formatNumber(c.a.average) }}</td>
              <td class="num">{{ c.a.rows }}</td>
              <td class="num">{{ c.a.reviewers }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="s-h2">Live transmissions</h2>
        <div v-if="!feed" class="s-empty">…</div>
        <template v-else>
          <div class="s-trans head" style="grid-template-columns: 1.4fr 1fr 62px 84px"><span>Station</span><span>Operator</span><span class="num">Level</span><span class="num">Time</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="s-trans" style="grid-template-columns: 1.4fr 1fr 62px 84px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="s-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="s-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'SWEEPING…' : 'EARLIER TRANSMISSIONS' }}</button><span /></nav>
        </template>
      </div>

      <aside class="s-side">
        <div class="s-panel">
          <h3 class="s-h3">Jammers</h3>
          <p v-if="!stats.suspects.length" class="s-empty">BAND CLEAR</p>
          <ul v-else class="s-list">
            <li v-for="s in stats.suspects.slice(0, 12)" :key="s.client" style="display: block">
              <div><RouterLink :to="to.reviewer(s.client)" class="s-mono">{{ shortAddress(s.client) }}</RouterLink></div>
              <div style="font-size: 10px; color: var(--s-red)">{{ labelsText(s.labels) }} · {{ s.rows }} tx / {{ s.agents }} stations</div>
            </li>
          </ul>
        </div>
        <div class="s-panel">
          <h3 class="s-h3">Mirror signals</h3>
          <p v-if="!stats.lookalikes.length" class="s-empty">No paired carriers.</p>
          <ul v-else class="s-list">
            <li v-for="(g, i) in stats.lookalikes.slice(0, 8)" :key="i" style="display: block">
              <div>
                <template v-for="a in g.agents" :key="a.tokenId.toString()">
                  <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)"> ~ </template>
                </template>
              </div>
              <div class="soft" style="font-size: 10px">{{ formatPercent(g.similarity) }} shared operators</div>
            </li>
          </ul>
        </div>
        <div class="s-panel">
          <h3 class="s-h3">Band plan</h3>
          <p class="s-note">Carrier frequencies run {{ BAND.low.toFixed(2) }}–{{ BAND.high.toFixed(2) }} MHz. An operator's level is the raw mean; the station page applies the demodulation steps.</p>
        </div>
      </aside>
    </div>
  </template>
</template>
