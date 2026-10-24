<script setup lang="ts">
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
</script>

<template>
  <p v-if="!address" class="h-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="h-kicker"><RouterLink :to="to.network()">Survey report</RouterLink> / observer sheet</p>
    <h1 class="h-h1">Observer {{ address.slice(0, 6) }}…{{ address.slice(-4) }}</h1>
    <p class="h-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="h-mono">{{ address }}</a></p>
    <p v-if="error" class="h-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="h-empty">Opening the notebook…</p>
    <template v-else>
      <div class="h-tiles">
        <div><small>Sightings</small><b>{{ profile.rows }}</b></div>
        <div><small>Specimens</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean value</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Peak in 24h</small><b>{{ profile.peakPerDay }}</b></div>
      </div>
      <div class="h-cols">
        <div>
          <h2 class="h-h2" style="margin-top: 0">Habits</h2>
          <p v-if="!profile.labels.length" class="h-empty">No notable habit was recorded.</p>
          <ul v-else class="h-notes">
            <li v-for="l in profile.labels" :key="l"><b>{{ LABEL_INFO[l].label }}</b> — {{ LABEL_INFO[l].rule }}</li>
          </ul>
          <p v-if="profile.mode" class="h-lede" style="font-size: 17px">
            Most sightings carry the value {{ formatScore(profile.mode.value) }} ({{ formatPercent(profile.mode.share) }} of the notebook).
          </p>
          <h2 class="h-h2">Specimens visited</h2>
          <table class="h-table">
            <thead><tr><th>Specimen</th><th class="num">Sightings</th><th class="num">Struck</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)"><i>{{ a.agentName ?? `Agent ${a.tokenId}` }}</i></RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>
          <h2 class="h-h2">Notebook</h2>
          <div v-if="!feed" class="h-empty">…</div>
          <template v-else>
            <div class="h-obs head" style="grid-template-columns: 1.5fr 70px 90px"><span>Specimen</span><span class="num">Value</span><span class="num">When</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="h-obs" style="grid-template-columns: 1.5fr 70px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="h-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Looking…' : 'Earlier entries' }}</button><span /></nav>
          </template>
        </div>
        <aside class="h-side">
          <h2 class="h-h2" style="margin-top: 0">Collector's note</h2>
          <p v-if="wallet.data.value">{{ wallet.data.value.nonce ?? '?' }} transactions; account reads as {{ wallet.data.value.kind ?? 'unknown' }}.</p>
          <p v-else>Account details unavailable.</p>
          <p v-if="profile.first">First entry {{ formatDate(profile.first) }}<template v-if="profile.last">; last {{ formatDate(profile.last) }}</template>.</p>
          <p>This sheet records habits, not intent. A label is a rule that fired, and the rule is printed on the specimen.</p>
        </aside>
      </div>
    </template>
  </template>
</template>
