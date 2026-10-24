<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { callNumberOf } from './archive'

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
  <p v-if="!address" class="x-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="x-kicker"><RouterLink :to="to.network()">Reading room</RouterLink> / reader file</p>
    <h1 class="x-h1">Reader's file</h1>
    <p class="x-lede">
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="x-mono">{{ address }}</a>
      · {{ profile?.rows ?? '…' }} items consulted
    </p>
    <p v-if="error" class="x-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="x-empty">Fetching the reader's card…</p>
    <template v-else>
      <div class="x-tiles">
        <div><small>Items consulted</small><b>{{ profile.rows }}</b></div>
        <div><small>Records</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean score</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Against registry</small><b>{{ formatSigned(gap) }}</b></div>
      </div>

      <div class="x-columns">
        <div>
          <h2 class="x-h2" style="margin-top: 0">Records consulted</h2>
          <table class="x-table">
            <thead><tr><th>Call</th><th>Record</th><th class="num">Items</th><th class="num">Withdrawn</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td class="call">{{ callNumberOf(a.tokenId) }}</td>
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>

          <h2 class="x-h2">Reader's habits</h2>
          <p v-if="!profile.labels.length" class="x-empty">No habit is noted in the file.</p>
          <table v-else class="x-table">
            <thead><tr><th>Label</th><th>Rule</th></tr></thead>
            <tbody>
              <tr v-for="l in profile.labels" :key="l">
                <td :class="LABEL_INFO[l].tone === 'warn' ? 'x-flag' : ''">{{ LABEL_INFO[l].label }}</td>
                <td class="soft" style="white-space: normal">{{ LABEL_INFO[l].rule }}</td>
              </tr>
            </tbody>
          </table>
          <p class="x-prose" style="font-size: 11.5px">
            <template v-if="profile.mode">Most common entry {{ formatScore(profile.mode.value) }}, {{ formatPercent(profile.mode.share) }} of live items. </template>
            Busiest day: {{ profile.peakPerDay }} items. {{ profile.revoked }} item{{ profile.revoked === 1 ? '' : 's' }} withdrawn.
          </p>

          <h2 class="x-h2">Consultation log</h2>
          <div v-if="!feed" class="x-empty">…</div>
          <template v-else>
            <div class="x-item head" style="grid-template-columns: 1.5fr 58px 90px"><span>Record</span><span class="num">Score</span><span class="num">When</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="x-item" style="grid-template-columns: 1.5fr 58px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="x-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Retrieving…' : 'Earlier consultations' }}</button><span /></nav>
          </template>
        </div>

        <aside class="x-side">
          <span class="x-tape">Reader card</span>
          <dl class="x-spec" style="margin-top: 10px">
            <dt>Account</dt><dd>{{ wallet.data.value?.kind ?? '—' }}</dd>
            <dt>Transactions</dt><dd>{{ wallet.data.value?.nonce ?? '—' }}</dd>
            <dt>First item</dt><dd>{{ profile.first ? formatDate(profile.first) : '—' }}</dd>
            <dt>Last item</dt><dd>{{ profile.last ? formatDate(profile.last) : '—' }}</dd>
            <dt>Items</dt><dd>{{ profile.rows }}</dd>
            <dt>Withdrawn</dt><dd>{{ profile.revoked }}</dd>
          </dl>
          <h2 class="x-h2">Desk note</h2>
          <p class="x-prose" style="font-size: 11.5px">
            A habit recorded here is a rule that fired against the item list, not a finding about the reader. The
            register records consultations, not motives.
          </p>
          <p class="x-mono" style="margin-top: 10px"><RouterLink :to="to.reviewer(address)">Permanent link to this file</RouterLink></p>
        </aside>
      </div>
    </template>
  </template>
</template>
