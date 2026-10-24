<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { freqText, frequencyOf, modeOf, sMeterOf } from './radio'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const ecosystem = useEcosystem()
const gap = computed(() => {
  const mine = profile.value?.average
  const all = ecosystem.data.value?.averageFeedback
  return mine === null || mine === undefined || all === undefined ? null : mine - all
})
const meter = computed(() => sMeterOf(profile.value?.average))
const freq = computed(() => frequencyOf(BigInt(parseInt(props.address.slice(2, 10), 16) || 0)))
</script>

<template>
  <p v-if="!address" class="s-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="s-kicker"><RouterLink :to="to.network()">SPECTRUM</RouterLink> / OPERATOR LOG</p>
    <div class="s-readout" style="margin-top: 6px">
      <div>
        <div class="call">OPERATOR · {{ profile ? modeOf(profile.average) : '…' }}</div>
        <div class="freq-big">{{ freq.toFixed(2) }}<small> MHz (house)</small></div>
        <div class="s-meter" style="margin-top: 6px"><i v-for="n in 10" :key="n" :class="{ on: n <= meter.bars, hot: n > 8 }" style="height: 14px" /><span class="soft" style="align-self: center; margin-left: 8px">{{ meter.label }}</span></div>
      </div>
      <div class="meta">
        <div>TRANSMISSIONS <b>{{ profile?.rows ?? '—' }}</b></div>
        <div>STATIONS <b>{{ profile?.agents ?? '—' }}</b></div>
        <div>MEAN LEVEL <b>{{ formatNumber(profile?.average) }}</b></div>
        <div>VS NETWORK <b>{{ formatSigned(gap) }}</b></div>
      </div>
    </div>
    <p class="s-lede" style="margin-top: 12px"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="s-mono">{{ address }}</a> · {{ freqText(freq) }} is the house frequency assigned to this address for display only.</p>
    <p v-if="error" class="s-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="s-empty">READING LOG…</p>
    <template v-else>
      <div class="s-tiles">
        <div><small>Transmissions</small><b>{{ profile.rows }}</b></div>
        <div><small>Stations</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean level</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Against network</small><b>{{ formatSigned(gap) }}</b></div>
      </div>

      <div class="s-columns" style="margin-top: 16px">
        <div>
          <h2 class="s-h2" style="margin-top: 0">Operating pattern</h2>
          <p v-if="!profile.labels.length" class="s-empty">NO FLAGS</p>
          <table v-else class="s-table">
            <thead><tr><th>Flag</th><th>Rule</th></tr></thead>
            <tbody>
              <tr v-for="l in profile.labels" :key="l">
                <td :class="LABEL_INFO[l].tone === 'warn' ? 's-err' : 'soft'">{{ LABEL_INFO[l].label }}</td>
                <td class="soft" style="white-space: normal">{{ LABEL_INFO[l].rule }}</td>
              </tr>
            </tbody>
          </table>
          <p class="s-prose" style="font-size: 11px">
            <template v-if="profile.mode">Most common level {{ formatScore(profile.mode.value) }} ({{ formatPercent(profile.mode.share) }}). </template>
            Peak day: {{ profile.peakPerDay }} transmissions. {{ profile.revoked }} squelched.
          </p>

          <h2 class="s-h2">Stations worked</h2>
          <table class="s-table">
            <thead><tr><th>Frequency</th><th>Station</th><th class="num">Tx</th><th class="num">Squelched</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td class="freq">{{ freqText(frequencyOf(a.tokenId)) }}</td>
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>

          <h2 class="s-h2">Transmission log</h2>
          <div v-if="!feed" class="s-empty">…</div>
          <template v-else>
            <div class="s-trans head" style="grid-template-columns: 1.5fr 62px 90px"><span>Station</span><span class="num">Level</span><span class="num">Time</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="s-trans" style="grid-template-columns: 1.5fr 62px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="s-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'READING…' : 'EARLIER LOG' }}</button><span /></nav>
          </template>
        </div>

        <aside class="s-side">
          <div class="s-panel">
            <h3 class="s-h3">Operator identity</h3>
            <table class="s-table">
              <tbody>
                <tr><td class="soft">Account</td><td>{{ wallet.data.value?.kind ?? '—' }}</td></tr>
                <tr><td class="soft">Nonce</td><td>{{ wallet.data.value?.nonce ?? '—' }}</td></tr>
                <tr><td class="soft">First heard</td><td>{{ profile.first ? formatDate(profile.first) : '—' }}</td></tr>
                <tr><td class="soft">Last heard</td><td>{{ profile.last ? formatDate(profile.last) : '—' }}</td></tr>
                <tr><td class="soft">Squelched</td><td>{{ profile.revoked }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="s-panel">
            <h3 class="s-h3">Log note</h3>
            <p class="s-note">A flag records a rule that fired against this operator's transmissions; it is not a finding about intent. The network page lists every flagged operator in the window.</p>
          </div>
        </aside>
      </div>
    </template>
  </template>
</template>
