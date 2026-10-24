<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline } from '../../format'
import { stdDev } from '../shared/metrics'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const spread = computed(() => stdDev((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value)))
// Semicircular gauge: the needle points at the reviewer's mean on a 0–100 arc.
const needle = computed(() => {
  const a = Math.PI - ((profile.value?.average ?? 0) / 100) * Math.PI
  return { x: 110 + Math.cos(a) * 76, y: 100 - Math.sin(a) * 76 }
})
</script>

<template>
  <p v-if="!address" class="bp-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="bp-kicker"><RouterLink :to="to.network()">SYSTEM DIAGRAM</RouterLink> / INSPECTOR CALIBRATION</p>
    <h1 class="bp-h1">Inspector {{ address.slice(0, 6) }}…{{ address.slice(-4) }}</h1>
    <p class="bp-prose"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="bp-mono">{{ address }}</a></p>
    <p v-if="error" class="bp-err">{{ error }} <button @click="load()">RETRY</button></p>
    <p v-else-if="!profile" class="bp-empty">Calibrating…</p>
    <template v-else>
      <div class="bp-cols">
        <div>
          <h2 class="bp-h2">Calibration gauge</h2>
          <div class="tb-wrap">
            <svg class="tb-svg" viewBox="0 0 220 130" role="img" aria-label="Mean rating gauge">
              <path d="M34,100 A76,76 0 0 1 186,100" class="line" stroke-width="8" />
              <path d="M34,100 A76,76 0 0 1 87.5,26.8" class="edge" stroke-width="8" />
              <path d="M87.5,26.8 A76,76 0 0 1 132.5,26.8" class="line" stroke-width="8" stroke="#ffc857" />
              <path d="M132.5,26.8 A76,76 0 0 1 186,100" class="line" stroke-width="8" stroke="#ff7a7a" />
              <line x1="110" y1="100" :x2="needle.x" :y2="needle.y" stroke="#eaf4ff" stroke-width="2" />
              <circle cx="110" cy="100" r="3" fill="#6fdcff" />
              <text x="34" y="118" text-anchor="middle" class="dim" font-size="8">0</text>
              <text x="110" y="118" text-anchor="middle" class="dim" font-size="8">50</text>
              <text x="186" y="118" text-anchor="middle" class="dim" font-size="8">100</text>
              <text x="110" y="88" text-anchor="middle" font-size="18">{{ formatNumber(profile.average) }}</text>
            </svg>
          </div>
          <div class="bp-panel" style="margin-top: 12px">
            <h3>Calibration values</h3>
            <div class="bp-kv"><span>Filings</span><b>{{ profile.rows }}</b></div>
            <div class="bp-kv"><span>Parts inspected</span><b>{{ profile.agents }}</b></div>
            <div class="bp-kv"><span>Spread (σ of values)</span><b>{{ formatNumber(spread, 2) }}</b></div>
            <div class="bp-kv"><span>Peak in 24h</span><b>{{ profile.peakPerDay }}</b></div>
            <div class="bp-kv"><span>Most frequent value</span><b>{{ profile.mode ? `${formatScore(profile.mode.value)} (${formatPercent(profile.mode.share)})` : '—' }}</b></div>
          </div>
          <h2 class="bp-h2">Observed non-conformances</h2>
          <p v-if="!profile.labels.length" class="bp-empty">None.</p>
          <ul v-else class="bp-list">
            <li v-for="l in profile.labels" :key="l"><b>{{ LABEL_INFO[l].label.toUpperCase() }}</b> · {{ LABEL_INFO[l].rule }}</li>
          </ul>
        </div>
        <aside>
          <h2 class="bp-h2" style="margin-top: 0">Parts inspected</h2>
          <table class="bp-table">
            <thead><tr><th>Part</th><th class="num">Rows</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>
          <h2 class="bp-h2">Calibration log</h2>
          <div v-if="!feed" class="bp-empty">…</div>
          <template v-else>
            <div v-for="(r, i) in feed.items.slice(0, 40)" :key="i" class="bp-kv" :class="{ revoked: r.revoked }">
              <span><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink></span>
              <span class="soft">{{ formatScore(r.value) }} · {{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <button v-if="feed.cursor" :disabled="loading" style="margin-top: 10px" @click="load(true)">{{ loading ? 'READING…' : 'EARLIER' }}</button>
          </template>
          <h2 class="bp-h2">Account</h2>
          <p class="bp-note" v-if="wallet.data.value">{{ wallet.data.value.nonce ?? '?' }} transactions · {{ wallet.data.value.kind ?? 'unknown type' }}<template v-if="profile.first"> · first filing {{ formatDate(profile.first) }}</template></p>
        </aside>
      </div>
    </template>
  </template>
</template>
