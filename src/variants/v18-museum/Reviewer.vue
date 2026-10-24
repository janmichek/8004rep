<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { accessionOf } from './museum'

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
</script>

<template>
  <p v-if="!address" class="m-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="m-kicker"><RouterLink :to="to.network()">Collection</RouterLink> / visitor record</p>
    <h1 class="m-h1">Visitor record</h1>
    <p class="m-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="m-mono">{{ address }}</a></p>
    <p v-if="error" class="m-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="m-empty">Finding the visitor's card…</p>
    <template v-else>
      <div class="m-tiles">
        <div><small>Entries</small><b>{{ profile.rows }}</b></div>
        <div><small>Works visited</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean score</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Against the collection</small><b>{{ formatSigned(gap) }}</b></div>
      </div>

      <div class="m-columns">
        <div>
          <h2 class="m-h2" style="margin-top: 0">Works visited</h2>
          <table class="m-table">
            <thead><tr><th>Accession</th><th>Work</th><th class="num">Visits</th><th class="num">Withdrawn</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td class="m-mono soft">{{ accessionOf(a.tokenId) }}</td>
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>

          <h2 class="m-h2">The visitor's hand</h2>
          <p v-if="!profile.labels.length" class="m-empty">No pattern is noted.</p>
          <ul v-else class="m-list">
            <li v-for="l in profile.labels" :key="l" style="display: block">
              <div :class="LABEL_INFO[l].tone === 'warn' ? 'm-warn' : ''"><b>{{ LABEL_INFO[l].label }}</b></div>
              <div class="soft" style="font-size: 12px">{{ LABEL_INFO[l].rule }}</div>
            </li>
          </ul>
          <p class="m-prose" style="font-size: 13px">
            <template v-if="profile.mode">The most common entry is {{ formatScore(profile.mode.value) }}, {{ formatPercent(profile.mode.share) }} of live entries. </template>
            The busiest day holds {{ profile.peakPerDay }} entries.
          </p>

          <h2 class="m-h2">Entry log</h2>
          <div v-if="!feed" class="m-empty">…</div>
          <template v-else>
            <div class="m-entry head" style="grid-template-columns: 1.5fr 66px 90px"><span>Work</span><span class="num">Score</span><span class="num">When</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="m-entry" style="grid-template-columns: 1.5fr 66px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="m-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Fetching…' : 'Earlier entries' }}</button><span /></nav>
          </template>
        </div>

        <aside class="m-side">
          <h2 class="m-h2" style="margin-top: 0">Visitor card</h2>
          <dl class="m-spec" style="border-top: 0; padding-top: 0">
            <dt>Account</dt><dd>{{ wallet.data.value?.kind ?? '—' }}</dd>
            <dt>Transactions</dt><dd>{{ wallet.data.value?.nonce ?? '—' }}</dd>
            <dt>First entry</dt><dd>{{ profile.first ? formatDate(profile.first) : '—' }}</dd>
            <dt>Last entry</dt><dd>{{ profile.last ? formatDate(profile.last) : '—' }}</dd>
            <dt>Entries</dt><dd>{{ profile.rows }}</dd>
          </dl>
          <h2 class="m-h2">A note on records</h2>
          <p class="m-prose" style="font-size: 13px">
            The record counts entries, not taste. A pattern is a rule that fired; it does not establish why the visitor
            wrote what they wrote.
          </p>
        </aside>
      </div>
    </template>
  </template>
</template>
