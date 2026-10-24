<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const ecosystem = useEcosystem()
const bias = computed(() =>
  profile.value?.average === null || profile.value?.average === undefined || ecosystem.data.value?.averageFeedback === undefined
    ? null
    : profile.value.average - ecosystem.data.value.averageFeedback,
)
</script>

<template>
  <p v-if="!address" class="f-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="f-kicker"><RouterLink :to="to.network()">Regional bulletin</RouterLink> / observer</p>
    <h1 class="f-h1">Observer report</h1>
    <p class="f-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="f-mono">{{ address }}</a></p>
    <p v-if="error" class="f-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="f-empty">Reading the observer's log…</p>
    <template v-else>
      <div class="f-stats">
        <div class="f-stat"><small>Readings</small><b>{{ profile.rows }}</b></div>
        <div class="f-stat"><small>Stations</small><b>{{ profile.agents }}</b></div>
        <div class="f-stat"><small>Mean reading</small><b>{{ formatNumber(profile.average) }}°</b></div>
        <div class="f-stat"><small>Bias vs ecosystem</small><b>{{ formatSigned(bias) }}</b></div>
      </div>
      <div class="f-columns">
        <div>
          <h2 class="f-h2">Observer habits</h2>
          <p v-if="!profile.labels.length" class="f-empty">No habit is strong enough to label.</p>
          <div v-for="l in profile.labels" :key="l" class="f-advisory warn">
            <b>{{ LABEL_INFO[l].label }}</b>{{ LABEL_INFO[l].rule }}
          </div>
          <p v-if="profile.mode" class="f-prose">
            The most common reading is {{ formatScore(profile.mode.value) }}°, {{ formatPercent(profile.mode.share) }} of all live readings.
            The busiest 24 hours contain {{ profile.peakPerDay }} readings.
          </p>
          <h2 class="f-h2">Stations observed</h2>
          <table class="f-table">
            <thead><tr><th>Station</th><th class="num">Readings</th><th class="num">Struck</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num">{{ formatNumber(a.average) }}°</td>
              </tr>
            </tbody>
          </table>
          <h2 class="f-h2">Reading log</h2>
          <div v-if="!feed" class="f-empty">…</div>
          <template v-else>
            <div class="f-obs head" style="grid-template-columns: 1.4fr 70px 90px"><span>Station</span><span class="num">Value</span><span class="num">When</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="f-obs" style="grid-template-columns: 1.4fr 70px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}°</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="f-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Reading…' : 'Earlier readings' }}</button><span /></nav>
          </template>
        </div>
        <aside>
          <div class="f-panel">
            <h3>Observer account</h3>
            <p v-if="wallet.data.value" class="f-prose" style="font-size: 13px">
              {{ wallet.data.value.nonce ?? '?' }} transactions sent; the account reads as
              {{ wallet.data.value.kind ?? 'unknown' }}.
            </p>
            <p v-else class="f-empty">Account details unavailable.</p>
            <p v-if="profile.first" class="f-prose" style="font-size: 13px">First reading {{ formatDate(profile.first) }}<template v-if="profile.last">; last {{ formatDate(profile.last) }}</template>.</p>
          </div>
          <div class="f-panel" style="margin-top: 14px">
            <h3>How to read this</h3>
            <p class="f-prose" style="font-size: 13px">
              Bias compares the observer's mean with the ecosystem mean. A habit label is a rule that fired, not a
              finding about intent.
            </p>
          </div>
        </aside>
      </div>
    </template>
  </template>
</template>
