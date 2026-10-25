<script setup lang="ts">
import { computed } from 'vue'
import { dailyColumns } from '../../data/chartData'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { gini, labelsText, topShare } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)

const concentration = computed(() => {
  const per = new Map<string, number>()
  for (const r of feed.value?.items ?? []) per.set(String(r.tokenId), (per.get(String(r.tokenId)) ?? 0) + 1)
  const counts = [...per.values()]
  return { gini: gini(counts), top: topShare(counts, 3) }
})

// The lead story is whichever finding is most alarming.
const lead = computed(() => {
  const s = stats.value
  if (!s) return undefined
  const perfect = s.perfectShare ?? 0
  if (s.suspects.length >= 3)
    return {
      kicker: 'Investigation',
      head: `${s.suspects.length} reviewers trip the network's own rules`,
      deck: `Of ${s.reviewers} addresses that left feedback in this window, ${formatPercent(s.suspects.length / Math.max(1, s.reviewers))} behave like rubber stamps, bulk writers or single-agent fans.`,
    }
  if (perfect > 0.7)
    return {
      kicker: 'Grade inflation',
      head: `${formatPercent(perfect)} of all feedback are a perfect 100`,
      deck: 'A market where nearly everyone gets full marks cannot tell good agents from great ones.',
    }
  if ((concentration.value.top ?? 0) > 0.5)
    return {
      kicker: 'Concentration',
      head: `Three agents take ${formatPercent(concentration.value.top)} of the attention`,
      deck: 'Feedback on the network is landing on a handful of names.',
    }
  return {
    kicker: 'Market report',
    head: `${s.rows} feedback, ${s.agents} agents, an average of ${formatNumber(s.average)}`,
    deck: 'A quiet window: no rule fires on most reviewers, and values are spread.',
  }
})
const volume = computed(() => {
  const cols = dailyColumns(feed.value?.items ?? [], (r) => r.createdAt, () => 'n', ['n'], { n: 'feedback' })
  const counts = cols.map((c) => c.segments.reduce((a, s) => a + s.value, 0))
  const max = Math.max(1, ...counts)
  const w = 600
  const h = 120
  const step = w / Math.max(1, counts.length)
  return { bars: counts.map((n, i) => ({ x: i * step, h: (n / max) * h, w: Math.max(1, step - 1), title: `${cols[i].label}: ${n}` })), w, h, first: cols[0]?.label, last: cols.at(-1)?.label }
})
const quote = computed(() => feed.value?.items.find((r) => r.feedbackURI && !r.revoked))
</script>

<template>
  <p v-if="error" class="l-notice">The wire is down: {{ error }} <button @click="load()">Retry</button></p>
  <p v-else-if="!stats" class="l-deck" aria-busy="true">Going to press — gathering the latest feedback of {{ chain.name }}…</p>
  <template v-if="stats && feed && lead">
    <div class="l-grid">
      <article>
        <p class="l-kicker">{{ lead.kicker }} · {{ chain.name }}</p>
        <h2 class="l-head">{{ lead.head }}</h2>
        <p class="l-deck">{{ lead.deck }}</p>
        <p class="l-byline">By the numbers desk · {{ stats.from && stats.to ? `${formatDate(stats.from)} to ${formatDate(stats.to)}` : 'undated window' }}</p>
        <div class="l-cols">
          <p>
            In the {{ stats.rows }} most recent feedback on {{ chain.name }}, {{ stats.reviewers }} addresses rated {{ stats.agents }} agents, an
            average of {{ formatNumber(stats.rows / Math.max(1, stats.reviewers)) }} feedback apiece. The mean value given was {{ formatNumber(stats.average) }}<template v-if="ecosystem.data.value">, against {{ formatNumber(ecosystem.data.value.averageFeedback) }} across every network 8004scan indexes</template>.
          </p>
          <p>
            Perfect scores accounted for {{ formatPercent(stats.perfectShare) }} of non-revoked feedback, and {{ stats.revoked }} were later withdrawn by their authors.
            The attention is {{ (concentration.gini ?? 0) > 0.6 ? 'heavily lopsided' : (concentration.gini ?? 0) > 0.35 ? 'uneven' : 'fairly even' }}: a Gini of
            {{ formatNumber(concentration.gini, 2) }} across agents, with the three busiest taking {{ formatPercent(concentration.top) }} of all feedback.
          </p>
          <p>
            Investigators flagged {{ stats.suspects.length }} reviewers and found {{ stats.lookalikes.length }} groups of agents rated by nearly the same crowd —
            the shape of a feedback ring, an agent farm, or simply a test suite.
          </p>
        </div>
        <figure style="margin: 18px 0 0">
          <svg class="l-chart" :viewBox="`0 0 ${volume.w} ${volume.h + 4}`" role="img" aria-label="Feedback per day">
            <rect v-for="(b, i) in volume.bars" :key="i" :x="b.x" :y="volume.h - b.h" :width="b.w" :height="b.h" fill="#1b1a17"><title>{{ b.title }}</title></rect>
            <line x1="0" :x2="volume.w" :y1="volume.h + 1" :y2="volume.h + 1" stroke="#1b1a17" />
          </svg>
          <figcaption class="muted" style="font-size: 12px">Feedback per day, {{ volume.first }} – {{ volume.last }}. Source: {{ chain.name }} reputation registry.</figcaption>
        </figure>
      </article>
      <aside>
        <p class="l-kicker">At a glance</p>
        <div class="l-figs" style="grid-template-columns: 1fr 1fr">
          <div><b>{{ stats.rows }}</b><small>feedback</small></div>
          <div><b>{{ stats.agents }}</b><small>agents rated</small></div>
          <div><b>{{ formatNumber(stats.average) }}</b><small>average value</small></div>
          <div><b :class="{ red: (stats.perfectShare ?? 0) > 0.7 }">{{ formatPercent(stats.perfectShare) }}</b><small>perfect 100s</small></div>
        </div>
        <blockquote v-if="quote?.feedbackURI" class="l-quote">
          <FeedbackNote :uri="quote.feedbackURI" />
          <cite>— {{ shortAddress(quote.client) }} on <RouterLink :to="to.agent(quote.tokenId)">{{ quote.agentName ?? `Agent #${quote.tokenId}` }}</RouterLink></cite>
        </blockquote>
        <p class="l-kicker">Most reviewed</p>
        <ol style="padding-left: 20px; margin: 0">
          <li v-for="a in stats.topAgents.slice(0, 8)" :key="a.tokenId.toString()">
            <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent #${a.tokenId}` }}</RouterLink>
            <span class="muted"> — {{ a.rows }} feedback, {{ a.reviewers }} reviewer{{ a.reviewers === 1 ? '' : 's' }}, avg {{ formatNumber(a.average) }}</span>
          </li>
        </ol>
        <p style="margin-top: 16px">
          <button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Printing…' : 'Late edition: load older feedback' }}</button>
          <span v-else class="muted">This edition covers everything on record.</span>
        </p>
      </aside>
    </div>

    <div class="l-three">
      <section>
        <p class="l-kicker">Police blotter</p>
        <h3 class="l-h3">Reviewers under suspicion</h3>
        <p v-if="!stats.suspects.length" class="muted">No reviewer in this window trips a rule.</p>
        <p v-for="s in stats.suspects.slice(0, 12)" :key="s.client" style="margin: 0 0 8px; font-size: 14px">
          <RouterLink :to="to.reviewer(s.client)" class="l-mono">{{ shortAddress(s.client) }}</RouterLink>,
          {{ s.rows }} feedback of {{ s.agents }} agent{{ s.agents === 1 ? '' : 's' }}, averaging {{ formatNumber(s.average) }}. Charged as
          <i>{{ labelsText(s.labels) }}</i>.
        </p>
      </section>
      <section>
        <p class="l-kicker">Rings</p>
        <h3 class="l-h3">Agents with the same admirers</h3>
        <p v-if="!stats.lookalikes.length" class="muted">No lookalike groups this window.</p>
        <p v-for="(g, i) in stats.lookalikes.slice(0, 8)" :key="i" style="margin: 0 0 8px; font-size: 14px">
          <template v-for="(a, j) in g.agents" :key="a.tokenId.toString()"><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink>{{ j < g.agents.length - 1 ? ', ' : '' }}</template>
          share {{ g.reviewers.length }} reviewers ({{ formatPercent(g.similarity) }} overlap).
        </p>
      </section>
      <section>
        <p class="l-kicker">The wire</p>
        <h3 class="l-h3">Latest feedback</h3>
        <p v-for="(r, i) in feed.items.slice(0, 14)" :key="i" style="margin: 0 0 6px; font-size: 14px" :class="{ muted: r.revoked }">
          <b>{{ formatScore(r.value) }}</b> for <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `#${r.tokenId}` }}</RouterLink>
          from <RouterLink :to="to.reviewer(r.client)" class="l-mono">{{ shortAddress(r.client) }}</RouterLink>
          <span class="muted"> {{ r.createdAt ? formatTimeline(r.createdAt) : '' }}{{ r.revoked ? ' · withdrawn' : '' }}</span>
        </p>
      </section>
    </div>
  </template>
</template>
