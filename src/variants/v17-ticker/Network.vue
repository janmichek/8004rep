<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { histogram, labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import { ratingOf } from './market'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const profile = computed(() => histogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value), 10))
const peak = computed(() => Math.max(1, ...profile.value.map((b) => b.count)))
const highest = computed(() => [...(stats.value?.topAgents ?? [])].filter((a) => a.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0)).slice(0, 8))
</script>

<template>
  <p class="t-kicker">MARKET · {{ chain.name.toUpperCase() }}</p>
  <h1 class="t-h1">Venue overview</h1>
  <p class="t-lede">
    {{ stats?.rows ?? '…' }} trades across {{ stats?.agents ?? '…' }} listings and {{ stats?.reviewers ?? '…' }} participants.
    The tape below is the last window the venue could load; percentages are of live trades only.
  </p>

  <p v-if="error" class="t-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="t-empty">OPENING THE MARKET…</p>
  <template v-else>
    <div class="t-tiles">
      <div><small>Last (mean)</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Volume</small><b>{{ stats.rows }}</b></div>
      <div><small>Perfect prints</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Busted</small><b class="t-down">{{ stats.revoked }}</b></div>
    </div>
    <p class="t-note">
      <template v-if="stats.from && stats.to">Session {{ formatDate(stats.from) }} → {{ formatDate(stats.to) }}. </template>
      Benchmarks: {{ formatNumber(ecosystem.data.value?.averageFeedback) }} venue-wide.
    </p>

    <div class="t-columns">
      <div>
        <h2 class="t-h2" style="margin-top: 0">Volume at price</h2>
        <div class="t-panel">
          <div v-for="(b, i) in profile" :key="i" style="display: grid; grid-template-columns: 54px 1fr 42px; gap: 8px; align-items: center; padding: 2px 0">
            <span class="t-dim" style="font-size: 10px">{{ Math.round(b.from) }}–{{ Math.round(b.to) }}</span>
            <span style="height: 10px; background: #121c1d"><span :style="{ display: 'block', height: '100%', width: `${(b.count / peak) * 100}%`, background: 'var(--t-up)', opacity: .7 }" /></span>
            <span class="num" style="font-size: 10px; text-align: right">{{ b.count }}</span>
          </div>
        </div>

        <h2 class="t-h2">Most active</h2>
        <table class="t-table">
          <thead><tr><th>Symbol</th><th>Listing</th><th class="num">Trades</th><th class="num">Participants</th><th class="num">Last</th><th>Grade</th></tr></thead>
          <tbody>
            <tr v-for="a in stats.topAgents.slice(0, 12)" :key="a.tokenId.toString()">
              <td class="t-sym"><RouterLink :to="to.agent(a.tokenId)">{{ (a.agentName ?? `A${a.tokenId}`).slice(0, 5).toUpperCase() }}</RouterLink></td>
              <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
              <td class="num">{{ a.rows }}</td>
              <td class="num">{{ a.reviewers }}</td>
              <td class="num">{{ formatNumber(a.average) }}</td>
              <td><span class="t-badge">{{ ratingOf(a.average) }}</span></td>
            </tr>
          </tbody>
        </table>

        <h2 class="t-h2">Tape</h2>
        <div v-if="!feed" class="t-empty">…</div>
        <template v-else>
          <div class="t-blotter head" style="grid-template-columns: 1.4fr 1fr 66px 84px"><span>Listing</span><span>Participant</span><span class="num">Px</span><span class="num">Time</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="t-blotter" style="grid-template-columns: 1.4fr 1fr 66px 84px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="t-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num t-dim">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="t-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'LOADING…' : 'OLDER TAPE' }}</button><span /></nav>
        </template>
      </div>

      <aside class="t-side">
        <div class="t-panel">
          <h3 class="t-h3">Highest marks</h3>
          <ul class="t-list">
            <li v-for="a in highest" :key="a.tokenId.toString()">
              <span><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></span>
              <span class="t-up">{{ formatNumber(a.average) }} <span class="t-dim">/ {{ a.reviewers }}p</span></span>
            </li>
          </ul>
        </div>
        <div class="t-panel">
          <h3 class="t-h3">Watchlist · participant patterns</h3>
          <p v-if="!stats.suspects.length" class="t-empty">Nothing flagged.</p>
          <ul v-else class="t-list">
            <li v-for="s in stats.suspects.slice(0, 12)" :key="s.client" style="display: block">
              <div><RouterLink :to="to.reviewer(s.client)">{{ shortAddress(s.client) }}</RouterLink></div>
              <div class="t-warn" style="font-size: 10px">{{ labelsText(s.labels) }} · {{ s.rows }} trades / {{ s.agents }} listings</div>
            </li>
          </ul>
        </div>
        <div class="t-panel">
          <h3 class="t-h3">Paired listings</h3>
          <p v-if="!stats.lookalikes.length" class="t-empty">No shared participant sets.</p>
          <ul v-else class="t-list">
            <li v-for="(g, i) in stats.lookalikes.slice(0, 8)" :key="i" style="display: block">
              <div>
                <template v-for="a in g.agents" :key="a.tokenId.toString()">
                  <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)"> ↔ </template>
                </template>
              </div>
              <div class="t-dim" style="font-size: 10px">{{ formatPercent(g.similarity) }} shared participants</div>
            </li>
          </ul>
        </div>
        <div class="t-panel">
          <h3 class="t-h3">Venue rules</h3>
          <p class="t-note">A last price is a raw mean. The listing page prints the weight adjustments that turn it into a trusted print.</p>
        </div>
      </aside>
    </div>
  </template>
</template>
