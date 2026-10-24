<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)

const health = computed(() => (stats.value?.perfectShare === null || stats.value?.perfectShare === undefined ? 'unknown' : stats.value.perfectShare > 0.7 ? 'critical' : stats.value.perfectShare > 0.4 ? 'watch' : 'nominal'))
const healthTone = computed(() => (health.value === 'critical' ? 'bad' : health.value === 'watch' ? 'warn' : 'ok'))
</script>

<template>
  <p class="bp-kicker">Sheet 02 / system diagram / {{ chain.name }}</p>
  <div class="bp-title">
    <div>
      <h1 class="bp-h1">Registry system, as drawn</h1>
      <p class="bp-prose">
        A window of {{ stats?.rows ?? '…' }} feedback events over {{ stats?.agents ?? '…' }} assemblies and
        {{ stats?.reviewers ?? '…' }} certifying reviewers. Events flow from reviewer to assembly; struck events are
        excluded from every rating below.
      </p>
    </div>
    <div class="bp-panel">
      <h3>System condition</h3>
      <p style="margin: 0 0 8px"><span class="bp-stamp" :class="healthTone">{{ health }}</span></p>
      <div class="bp-kv"><span>Perfect values</span><b>{{ formatPercent(stats?.perfectShare) }}</b></div>
      <div class="bp-kv"><span>Mean value</span><b>{{ formatNumber(stats?.average) }}</b></div>
      <div class="bp-kv"><span>Flagged reviewers</span><b>{{ stats?.suspects.length ?? '—' }}</b></div>
      <div class="bp-kv"><span>Mirror groups</span><b>{{ stats?.lookalikes.length ?? '—' }}</b></div>
    </div>
  </div>

  <p v-if="error" class="bp-err">{{ error }} <button @click="load()">RETRY</button></p>
  <p v-else-if="!stats" class="bp-empty">Reading the system…</p>
  <template v-else>
    <h2 class="bp-h2">Flow diagram</h2>
    <div class="tb-wrap">
      <svg class="tb-svg" viewBox="0 0 760 260" role="img" aria-label="Feedback flow diagram">
        <defs>
          <marker id="flow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#6fdcff" />
          </marker>
        </defs>
        <rect x="20" y="40" width="180" height="110" class="line" />
        <text x="110" y="70" text-anchor="middle" class="cyan" font-size="11">REVIEWERS</text>
        <text x="110" y="112" text-anchor="middle" font-size="34">{{ stats.reviewers }}</text>
        <text x="110" y="132" text-anchor="middle" class="dim" font-size="9">DISTINCT ADDRESSES</text>

        <rect x="290" y="20" width="200" height="150" class="line" stroke="#6fdcff" />
        <text x="390" y="50" text-anchor="middle" class="cyan" font-size="11">FILINGS</text>
        <text x="390" y="96" text-anchor="middle" font-size="40">{{ stats.rows }}</text>
        <text x="390" y="118" text-anchor="middle" class="dim" font-size="9">EVENTS READ</text>
        <text x="390" y="136" text-anchor="middle" class="dim" font-size="9">{{ stats.revoked }} STRUCK</text>
        <text x="390" y="152" text-anchor="middle" class="dim" font-size="9">MEAN {{ formatNumber(stats.average) }}</text>

        <rect x="580" y="40" width="160" height="110" class="line" />
        <text x="660" y="70" text-anchor="middle" class="cyan" font-size="11">ASSEMBLIES</text>
        <text x="660" y="112" text-anchor="middle" font-size="34">{{ stats.agents }}</text>
        <text x="660" y="132" text-anchor="middle" class="dim" font-size="9">CERTIFIED PARTS</text>

        <line x1="200" y1="95" x2="290" y2="95" class="edge" stroke-width="3" marker-end="url(#flow)" />
        <line x1="490" y1="95" x2="580" y2="95" class="edge" stroke-width="3" marker-end="url(#flow)" />
        <line x1="110" y1="150" x2="110" y2="220" class="dash" />
        <line x1="110" y1="220" x2="660" y2="220" class="dash" />
        <line x1="660" y1="220" x2="660" y2="150" class="dash" />
        <text x="390" y="214" text-anchor="middle" class="dim" font-size="8">REVIEWER → AGENT EDGES ARE COLLAPSED; SEE ASSEMBLY DRAWINGS FOR PER-PART TOPOLOGY</text>
        <text x="390" y="245" text-anchor="middle" class="dim" font-size="8">
          {{ stats.from && stats.to ? `WINDOW ${formatDate(stats.from)} — ${formatDate(stats.to)}` : 'WINDOW UNDATED' }}
          <template v-if="ecosystem.data.value"> · ECOSYSTEM MEAN {{ formatNumber(ecosystem.data.value.averageFeedback) }}</template>
        </text>
      </svg>
    </div>

    <div class="bp-cols">
      <div>
        <h2 class="bp-h2">Non-conformances</h2>
        <p v-if="!stats.suspects.length" class="bp-empty">No reviewer patterns flagged.</p>
        <table v-else class="bp-table">
          <thead><tr><th>Reviewer</th><th>Pattern</th><th class="num">Filings</th><th class="num">Parts</th><th class="num">Mean</th></tr></thead>
          <tbody>
            <tr v-for="s in stats.suspects.slice(0, 14)" :key="s.client">
              <td class="bp-mono"><RouterLink :to="to.reviewer(s.client)">{{ shortAddress(s.client) }}</RouterLink></td>
              <td class="dim">{{ labelsText(s.labels) }}</td>
              <td class="num">{{ s.rows }}</td>
              <td class="num">{{ s.agents }}</td>
              <td class="num">{{ formatNumber(s.average) }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="bp-h2">Mirror groups</h2>
        <p class="bp-empty" v-if="!stats.lookalikes.length">No near-identical reviewer sets.</p>
        <ul v-else class="bp-list">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 10)" :key="i">
            {{ formatPercent(g.similarity) }} shared —
            <template v-for="a in g.agents" :key="a.tokenId.toString()">
              <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink><template v-if="a !== g.agents.at(-1)"> · </template>
            </template>
          </li>
        </ul>

        <h2 class="bp-h2">Revision history</h2>
        <div v-if="!feed" class="bp-empty">…</div>
        <template v-else>
          <div class="bp-row head"><span>#</span><span>Part</span><span>Reviewer</span><span class="num">Value</span><span class="num">When</span></div>
          <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="bp-row" :class="{ revoked: r.revoked }">
            <span class="idx">{{ String(i + 1).padStart(2, '0') }}</span>
            <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
            <RouterLink :to="to.reviewer(r.client)" class="bp-mono">{{ shortAddress(r.client) }}</RouterLink>
            <span class="num">{{ formatScore(r.value) }}</span>
            <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
          </div>
          <nav class="bp-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'READING…' : 'EARLIER REVISIONS' }}</button><span /></nav>
        </template>
      </div>
      <aside>
        <h2 class="bp-h2" style="margin-top: 0">Most certified parts</h2>
        <ul class="bp-list">
          <li v-for="a in stats.topAgents.slice(0, 10)" :key="a.tokenId.toString()" class="bp-kv">
            <span><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></span>
            <span class="soft">{{ a.rows }} filings / {{ a.reviewers }} reviewers</span>
          </li>
        </ul>
        <h2 class="bp-h2">Tolerances</h2>
        <p class="bp-note">Values are read as drawn. A rating above 100 or below 0 is off the conventional scale and is noted on the part drawing.</p>
        <p class="bp-note">Flags are statistical, not findings: {{ stats.rows }} events, {{ stats.reviewers }} reviewers, {{ stats.revoked }} struck.</p>
      </aside>
    </div>
  </template>
</template>
