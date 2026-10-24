<script setup lang="ts">
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
</script>

<template>
  <header>
    <p class="d-kicker">Docket · {{ chain.name }}</p>
    <h1 class="d-h1">The court's record of {{ chain.name }}</h1>
    <p class="d-lede">
      A window of the latest {{ stats?.rows ?? '…' }} filings across {{ stats?.agents ?? '…' }} causes.
      Statistically notable parties are listed below; nothing here is a finding of fact.
    </p>
  </header>

  <p v-if="error" class="d-error">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="d-empty">Reading the docket…</p>
  <template v-else>
    <div class="d-figures">
      <div><small>Filings read</small><b>{{ formatNumber(stats.rows, 0) }}</b></div>
      <div><small>Perfect scores</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Average value</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Struck (revoked)</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="d-motif">
      {{ stats.agents }} causes, {{ stats.reviewers }} witnesses<template v-if="stats.from && stats.to"> · record runs {{ formatDate(stats.from) }} to {{ formatDate(stats.to) }}</template>
      <template v-if="ecosystem.data.value"> · ecosystem mean {{ formatNumber(ecosystem.data.value.averageFeedback) }}</template>
    </p>

    <div class="d-split">
      <div>
        <h2 class="d-h2">Parties of interest</h2>
        <p class="d-motif">Witnesses whose habits match a known pattern. Each label states its rule on the witness page.</p>
        <p v-if="!stats.suspects.length" class="d-empty">No patterns of interest.</p>
        <table v-else class="d-table">
          <thead><tr><th>Witness</th><th>Pattern</th><th class="num">Filings</th><th class="num">Causes</th><th class="num">Average</th></tr></thead>
          <tbody>
            <tr v-for="s in stats.suspects.slice(0, 16)" :key="s.client">
              <td class="d-mono"><RouterLink :to="to.reviewer(s.client)">{{ shortAddress(s.client) }}</RouterLink></td>
              <td class="d-flag">{{ labelsText(s.labels) }}</td>
              <td class="num">{{ s.rows }}</td>
              <td class="num">{{ s.agents }}</td>
              <td class="num">{{ formatNumber(s.average) }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="d-h2">Joint filings</h2>
        <p class="d-motif">Groups of causes whose witnesses nearly coincide.</p>
        <p v-if="!stats.lookalikes.length" class="d-empty">No groups found.</p>
        <ul v-else class="d-paras">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 10)" :key="i">
            <span class="soft">{{ formatPercent(g.similarity) }} shared witnesses:</span>
            <template v-for="a in g.agents" :key="a.tokenId.toString()">
              <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)">, </template>
            </template>
          </li>
        </ul>
      </div>
      <aside class="d-side">
        <h2 class="d-h2" style="margin-top: 0">Most active causes</h2>
        <ul class="d-list">
          <li v-for="a in stats.topAgents.slice(0, 10)" :key="a.tokenId.toString()">
            <span><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></span>
            <span class="soft">{{ a.rows }} filings · {{ a.reviewers }} witnesses</span>
          </li>
        </ul>
      </aside>
    </div>

    <h2 class="d-h2">Recent filings</h2>
    <div v-if="!feed" class="d-empty">…</div>
    <div v-else class="d-testimony">
      <div class="d-row head" style="grid-template-columns: 1fr 1fr 80px 90px 100px"><span>Cause</span><span>Witness</span><span class="v">Value</span><span>Tag</span><span class="v">Filed</span></div>
      <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="d-row" style="grid-template-columns: 1fr 1fr 80px 90px 100px" :class="{ revoked: r.revoked }">
        <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
        <RouterLink :to="to.reviewer(r.client)" class="d-mono">{{ shortAddress(r.client) }}</RouterLink>
        <span class="v">{{ formatScore(r.value) }}</span>
        <span class="soft">{{ r.tag1 ?? '—' }}</span>
        <span class="v soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
      </div>
    </div>
    <nav class="d-pager"><span /><button v-if="feed?.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Reading…' : 'Earlier filings' }}</button><span /></nav>
  </template>
</template>
