<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { pctOf, ratingOf, symbolOf } from './market'

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
const pct = computed(() => pctOf(ecosystem.data.value?.averageFeedback, profile.value?.average))
const rating = computed(() => ratingOf(profile.value?.average))
</script>

<template>
  <p v-if="!address" class="t-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="t-kicker"><RouterLink :to="to.network()">MARKET</RouterLink> / PARTICIPANT</p>
    <h1 class="t-h1">Participant file</h1>
    <p class="t-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ address }}</a></p>
    <p v-if="error" class="t-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="t-empty">LOADING FILE…</p>
    <template v-else>
      <div class="t-tiles">
        <div><small>Trades</small><b>{{ profile.rows }}</b></div>
        <div><small>Listings</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean print</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Grade</small><b style="font-size: 18px">{{ rating }}</b></div>
      </div>

      <div class="t-columns" style="margin-top: 18px">
        <div>
          <h2 class="t-h2" style="margin-top: 0">Bias vs the venue</h2>
          <p class="t-prose">
            Mean print {{ formatNumber(profile.average) }}, {{ formatSigned(gap) }} against the venue mean
            <template v-if="pct !== null">({{ formatSigned(pct) }}%)</template>. Most common print
            <template v-if="profile.mode">{{ formatScore(profile.mode.value) }}, {{ formatPercent(profile.mode.share) }} of live trades</template><template v-else>not established</template>.
          </p>

          <h2 class="t-h2">Pattern flags</h2>
          <p v-if="!profile.labels.length" class="t-empty">CLEAN</p>
          <table v-else class="t-table">
            <thead><tr><th>Flag</th><th>Rule</th></tr></thead>
            <tbody>
              <tr v-for="l in profile.labels" :key="l">
                <td :class="LABEL_INFO[l].tone === 'warn' ? 't-warn' : 't-soft'">{{ LABEL_INFO[l].label.toUpperCase() }}</td>
                <td class="t-dim" style="white-space: normal">{{ LABEL_INFO[l].rule }}</td>
              </tr>
            </tbody>
          </table>
          <p class="t-note">Peak activity: {{ profile.peakPerDay }} trades in one 24h window. {{ profile.revoked }} trade{{ profile.revoked === 1 ? '' : 's' }} busted.</p>

          <h2 class="t-h2">Positions</h2>
          <table class="t-table">
            <thead><tr><th>Symbol</th><th>Listing</th><th class="num">Trades</th><th class="num">Mean</th><th>Grade</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td class="t-sym">{{ symbolOf(a.agentName, a.tokenId) }}</td>
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
                <td><span class="t-badge">{{ ratingOf(a.average) }}</span></td>
              </tr>
            </tbody>
          </table>

          <h2 class="t-h2">Trade history</h2>
          <div v-if="!feed" class="t-empty">…</div>
          <template v-else>
            <div class="t-blotter head" style="grid-template-columns: 1.5fr 66px 90px"><span>Listing</span><span class="num">Px</span><span class="num">Time</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="t-blotter" style="grid-template-columns: 1.5fr 66px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num t-dim">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="t-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'LOADING…' : 'OLDER TRADES' }}</button><span /></nav>
          </template>
        </div>

        <aside class="t-side">
          <div class="t-panel">
            <h3 class="t-h3">Account</h3>
            <table class="t-table">
              <tbody>
                <tr><td class="t-dim">Kind</td><td>{{ wallet.data.value?.kind ?? '—' }}</td></tr>
                <tr><td class="t-dim">Nonce</td><td>{{ wallet.data.value?.nonce ?? '—' }}</td></tr>
                <tr><td class="t-dim">First</td><td>{{ profile.first ? formatDate(profile.first) : '—' }}</td></tr>
                <tr><td class="t-dim">Last</td><td>{{ profile.last ? formatDate(profile.last) : '—' }}</td></tr>
              </tbody>
            </table>
          </div>
          <div class="t-panel">
            <h3 class="t-h3">How to read this</h3>
            <p class="t-note">
              A participant's mean is not a price they set; it is the mean of prints they made. Flags are rules that
              fired, not findings about intent.
            </p>
          </div>
        </aside>
      </div>
    </template>
  </template>
</template>
