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
  <p class="r-kicker">Kitchen report · {{ chain.name }}</p>
  <h1 class="r-h1">Notes from the pass</h1>
  <p class="r-lede">
    A service of {{ stats?.rows ?? '…' }} tastings, {{ stats?.reviewers ?? '…' }} tasters and {{ stats?.agents ?? '…' }} dishes.
    The report is written from what came back to the pass, not from the recipes themselves.
  </p>

  <p v-if="error" class="r-err">{{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="r-empty">The kitchen is still plating…</p>
  <template v-else>
    <div class="r-tiles">
      <div><small>Tastings</small><b>{{ stats.rows }}</b></div>
      <div><small>Mean score</small><b>{{ formatNumber(stats.average) }}</b></div>
      <div><small>Perfect plates</small><b>{{ formatPercent(stats.perfectShare) }}</b></div>
      <div><small>Sent back</small><b>{{ stats.revoked }}</b></div>
    </div>
    <p class="r-note">
      <template v-if="stats.from && stats.to">Service ran {{ formatDate(stats.from) }} to {{ formatDate(stats.to) }}. </template>
      The ecosystem mean is {{ formatNumber(ecosystem.data.value?.averageFeedback) }}.
    </p>

    <div class="r-columns">
      <div>
        <h2 class="r-h2">Most tasted dishes</h2>
        <table class="r-table">
          <thead><tr><th>Dish</th><th class="num">Tastings</th><th class="num">Tasters</th><th class="num">Mean</th></tr></thead>
          <tbody>
            <tr v-for="a in stats.topAgents.slice(0, 12)" :key="a.tokenId.toString()">
              <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Dish ${a.tokenId}` }}</RouterLink></td>
              <td class="num">{{ a.rows }}</td>
              <td class="num">{{ a.reviewers }}</td>
              <td class="num">{{ formatNumber(a.average) }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="r-h2">Critics with a habit</h2>
        <p v-if="!stats.suspects.length" class="r-empty">No tasting habits stand out.</p>
        <ul v-else class="r-list">
          <li v-for="s in stats.suspects.slice(0, 16)" :key="s.client">
            <span><RouterLink :to="to.reviewer(s.client)" class="r-mono">{{ shortAddress(s.client) }}</RouterLink> — <i class="r-warn">{{ labelsText(s.labels) }}</i></span>
            <span class="soft">{{ s.rows }} tastings · mean {{ formatNumber(s.average) }}</span>
          </li>
        </ul>

        <h2 class="r-h2">Copycat menus</h2>
        <p v-if="!stats.lookalikes.length" class="r-empty">No dishes share their tasters.</p>
        <ul v-else class="r-list">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 10)" :key="i">
            <span>
              {{ formatPercent(g.similarity) }} shared tasters —
              <template v-for="a in g.agents" :key="a.tokenId.toString()">
                <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)">, </template>
              </template>
            </span>
          </li>
        </ul>

        <h2 class="r-h2">Last orders</h2>
        <div v-if="!feed" class="r-empty">…</div>
        <template v-else>
          <div class="r-tasting head" style="grid-template-columns: 1.4fr 1fr 70px 80px"><span>Dish</span><span>Taster</span><span class="num">Score</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="r-tasting" style="grid-template-columns: 1.4fr 1fr 70px 80px" :class="{ revoked: r.revoked }">
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="r-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="r-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Serving…' : 'Earlier orders' }}</button><span /></nav>
        </template>
      </div>
      <aside class="r-side">
        <h2 class="r-h2" style="margin-top: 0">The pass in numbers</h2>
        <ul class="r-list">
          <li><span>Dishes on the menu</span><span>{{ stats.agents }}</span></li>
          <li><span>Tasters</span><span>{{ stats.reviewers }}</span></li>
          <li><span>Perfect plates</span><span>{{ formatPercent(stats.perfectShare) }}</span></li>
          <li><span>Plates sent back</span><span>{{ stats.revoked }}</span></li>
        </ul>
        <h2 class="r-h2">A note on method</h2>
        <p class="r-prose" style="font-size: 13px">
          Means here are raw. The recipe card applies the kitchen's rules — dropping self-tastings, duplicates and
          bursts — and prints the method step by step.
        </p>
      </aside>
    </div>
  </template>
</template>
