<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import { sparkPath100 } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { bandwidthOf, frequencyOf, freqText, modeOf, sMeterOf, snrOf } from './radio'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
const freq = computed(() => frequencyOf(props.id))
const meter = computed(() => sMeterOf(report.value?.trusted))
const mode = computed(() => modeOf(report.value?.trusted))
const snr = computed(() => snrOf(report.value?.trusted, report.value?.lcb))
const bandwidth = computed(() => bandwidthOf(scores.value?.effectiveCount))
const history = computed(() => {
  const rows = (agent.value?.feedback ?? []).filter((f) => f.createdAt)
  const sorted = [...rows].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  return { values: sorted.map((f) => f.value), path: sparkPath100(sorted.map((f) => f.value), 720, 90) }
})
</script>

<template>
  <p v-if="error" class="s-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="s-empty">ACQUIRING CARRIER…</p>
  <template v-else-if="agent === null">
    <p class="s-kicker">NO CARRIER</p>
    <h1 class="s-h1">Nothing is transmitting at {{ freqText(freq) }}.</h1>
  </template>
  <template v-else>
    <p class="s-kicker"><RouterLink :to="to.agents()">BAND SCAN</RouterLink> / STATION #{{ agent.tokenId }}</p>
    <div class="s-readout">
      <div>
        <div class="call">{{ name }} · {{ mode }}</div>
        <div class="freq-big">{{ freq.toFixed(2) }}<small> MHz</small></div>
        <div style="margin-top: 6px" class="s-meter" :aria-label="meter.label">
          <i v-for="n in 10" :key="n" :class="{ on: n <= meter.bars, hot: n > 8 }" style="height: 100%" />
          <span class="soft" style="align-self: center; margin-left: 8px">{{ meter.label }}</span>
        </div>
      </div>
      <div class="meta">
        <div>SIGNAL <b>{{ formatNumber(report?.trusted) }}</b> / NOISE FLOOR <b>{{ formatNumber(report?.lcb) }}</b></div>
        <div>SNR <b>{{ snr === null ? '—' : `${formatNumber(snr)} dB` }}</b></div>
        <div>BANDWIDTH <b>{{ formatNumber(bandwidth, 1) }} kHz</b></div>
        <div>POWER <b>{{ formatNumber(scores?.effectiveCount) }}</b> full votes</div>
        <div>TRANSMISSIONS <b>{{ stats?.coverage.total ?? 0 }}</b></div>
      </div>
    </div>

    <h2 class="s-h2">Carrier history · demodulated from arrival order</h2>
    <p v-if="!history.values.length" class="s-empty">No dated transmissions.</p>
    <svg v-else class="s-dial" viewBox="0 0 740 110" role="img" aria-label="Signal history over time">
      <line x1="10" y1="100" x2="730" y2="100" class="s-grat-major" />
      <line x1="10" y1="55" x2="730" y2="55" class="s-grat" stroke-dasharray="2 3" />
      <line x1="10" y1="10" x2="730" y2="10" class="s-grat" stroke-dasharray="2 3" />
      <path :d="history.path" fill="none" stroke="var(--s-green)" stroke-width="1.6" transform="translate(10 5)" />
      <text x="12" y="18" class="s-dial-label">100</text>
      <text x="12" y="106" class="s-dial-label">0</text>
    </svg>
    <p class="s-note">Points are non-revoked and revoked transmissions in arrival order; the noise floor is shown separately, not subtracted here.</p>

    <div class="s-columns" style="margin-top: 16px">
      <div>
        <h2 class="s-h2" style="margin-top: 0">Transmissions</h2>
        <p v-if="!agent.feedback.length" class="s-empty">SILENT</p>
        <template v-else>
          <div class="s-trans head"><span>#</span><span>Payload</span><span>Operator</span><span class="num">Level</span><span class="num">Wt</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="s-trans" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join('/') || 'UNMODULATED' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> ·{{ FLAG_INFO[f].label }}</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num soft">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </template>

        <h2 class="s-h2">Demodulation steps</h2>
        <table class="s-table">
          <thead><tr><th>Stage</th><th>Rule</th><th class="num">Level</th><th class="num">Tx</th></tr></thead>
          <tbody>
            <tr v-for="step in report?.waterfall ?? []" :key="step.id">
              <td>{{ step.label }}</td>
              <td class="soft" style="white-space: normal">{{ step.rule }}</td>
              <td class="num">{{ step.average === null ? '—' : formatNumber(step.average) }}</td>
              <td class="num">{{ step.rows }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="s-side">
        <div class="s-panel">
          <h3 class="s-h3">Interference log</h3>
          <p v-if="!stats?.signals.length" class="s-empty">CLEAR CHANNEL</p>
          <ul v-else class="s-list">
            <li v-for="s in stats.signals" :key="s.code" style="display: block">
              <b :class="s.level === 'high' ? 's-err' : s.level === 'warn' ? '' : 'soft'">{{ s.code }}</b>
              <div class="soft" style="font-size: 10.5px">{{ s.text }}</div>
            </li>
          </ul>
        </div>
        <div class="s-panel">
          <h3 class="s-h3">Operators on frequency</h3>
          <ul class="s-list">
            <li v-for="r in stats?.reviewers ?? []" :key="r.client">
              <span><RouterLink :to="to.reviewer(r.client)" class="s-mono">{{ shortAddress(r.client) }}</RouterLink></span>
              <span class="soft">{{ r.rows }} · {{ formatPercent(r.weightShare) }}</span>
            </li>
          </ul>
        </div>
        <div class="s-panel">
          <h3 class="s-h3">Station data</h3>
          <table class="s-table">
            <tbody>
              <tr><td class="soft">Operator</td><td><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ shortAddress(agent.owner) }}</RouterLink><span v-else>—</span></td></tr>
              <tr><td class="soft">Wallet</td><td><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (SAME)' : '' }}</td></tr>
              <tr><td class="soft">First heard</td><td>{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</td></tr>
              <tr><td class="soft">Services</td><td style="white-space: normal">{{ file?.services.map((s) => s.name).join(', ') || '—' }}</td></tr>
              <tr><td class="soft">Trust</td><td style="white-space: normal">{{ file?.supportedTrust.join(', ') || '—' }}</td></tr>
              <tr><td class="soft">Noise</td><td>{{ formatNumber(report?.lcb) }}</td></tr>
              <tr><td class="soft">Raw mean</td><td>{{ formatNumber(report?.raw) }}</td></tr>
            </tbody>
          </table>
          <p class="s-note"><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">REGISTRATION FILE ↗</a><span v-else class="soft">INLINE FILE</span> · <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004SCAN ↗</a></p>
          <details v-if="rawJson"><summary class="s-kicker">RAW PAYLOAD</summary><pre>{{ rawJson }}</pre></details>
        </div>
        <div class="s-panel">
          <h3 class="s-h3">Receiver note</h3>
          <p class="s-prose" style="font-size: 10.5px">{{ report?.headline ?? 'No carrier.' }}</p>
          <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="s-note">· {{ reason }}</p>
        </div>
      </aside>
    </div>
  </template>
</template>
