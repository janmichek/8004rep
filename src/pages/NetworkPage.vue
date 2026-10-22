<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { findChainBySlug } from '../chains'
import FeedbackNote from '../components/FeedbackNote.vue'
import Spinner from '../components/ui/Spinner.vue'
import StatTiles, { type Tile } from '../components/ui/StatTiles.vue'
import { sourceFor } from '../data'
import { loadFeedWindow, type FeedWindow } from '../data/feed'
import { computeNetworkStats } from '../data/networkStats'
import { fetchScanStats } from '../data/scan'
import { errorMessage, formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../format'
import { useAsync } from '../useAsync'

const props = defineProps<{ slug: string }>()
const chain = computed(() => findChainBySlug(props.slug)!)

const feed = shallowRef<FeedWindow>()
const error = shallowRef<string>()
const loading = shallowRef(false)

async function load(extend = false): Promise<void> {
  const target = chain.value
  loading.value = true
  error.value = undefined
  try {
    const { source } = await sourceFor(target)
    const next = await loadFeedWindow(source, {}, { minRows: 250, maxSteps: 12, ...(extend && feed.value ? { from: feed.value } : {}) })
    if (target === chain.value) feed.value = next
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}
watch(
  chain,
  () => {
    feed.value = undefined
    void load()
  },
  { immediate: true },
)

const ecosystem = useAsync(() => fetchScanStats(), () => true)
const stats = computed(() => (feed.value ? computeNetworkStats(feed.value.items) : undefined))

function daySpan(from: number, to: number): string {
  const day = (t: number) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${day(from)} – ${day(to)}`
}

const tiles = computed<Tile[]>(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: 'Reviews in window', value: String(s.rows), hint: s.from && s.to ? daySpan(s.from, s.to) : '', tone: 'main' },
    { label: 'Agents rated', value: String(s.agents) },
    { label: 'Reviewers', value: String(s.reviewers), hint: `${formatNumber(s.rows / Math.max(1, s.reviewers))} reviews each` },
    {
      label: 'Average value',
      value: formatNumber(s.average),
      hint: [
        ecosystem.data.value ? `ecosystem ${formatNumber(ecosystem.data.value.averageFeedback)}` : '',
        s.average !== null && (s.average < 0 || s.average > 100) ? 'includes values outside 0–100' : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: 'Perfect 100s',
      value: formatPercent(s.perfectShare),
      hint: 'of non-revoked reviews',
      tone: (s.perfectShare ?? 0) > 0.7 ? 'warn' : undefined,
    },
    { label: 'Suspect reviewers', value: String(s.suspects.length), hint: `${s.lookalikes.length} lookalike groups`, tone: s.suspects.length ? 'warn' : 'good' },
  ]
})

function agentRoute(tokenId: bigint) {
  return { name: 'agent', params: { slug: chain.value.slug, id: tokenId.toString() } }
}
function reviewerRoute(address: string) {
  return { name: 'reviewer', params: { slug: chain.value.slug, address } }
}
</script>

<template>
  <div class="page-head">
    <h1>{{ chain.name }} <small>feedback health</small></h1>
  </div>
  <p class="lede">Patterns across the latest feedback of the network.</p>

  <p v-if="error" class="notice">Could not load the feed: {{ error }} <button @click="load()">Retry</button></p>
  <div v-else-if="!stats" class="loader"><Spinner large label="Loading the latest feedback" /></div>

  <template v-if="stats && feed">
    <StatTiles :tiles="tiles" />

    <section class="panel">
      <h3>Latest Reviews</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Agent</th><th>Reviewer</th><th class="num">Value</th><th>Tags</th><th>Text</th><th>When</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in feed.items.slice(0, 100)" :key="i" :class="{ revoked: r.revoked }">
              <td><RouterLink :to="agentRoute(r.tokenId)">{{ r.agentName ?? `Agent #${r.tokenId}` }}</RouterLink></td>
              <td><RouterLink :to="reviewerRoute(r.client)" class="mono">{{ shortAddress(r.client) }}</RouterLink></td>
              <td class="num"><b>{{ formatScore(r.value) }}</b></td>
              <td class="tags">
                <span v-if="r.tag1" class="chip clip-chip" :title="r.tag1">{{ r.tag1 }}</span>
                <span v-if="r.tag2" class="chip clip-chip" :title="r.tag2">{{ r.tag2 }}</span>
              </td>
              <td class="text-cell">
                <FeedbackNote v-if="r.feedbackURI" :uri="r.feedbackURI" />
                <span v-else class="muted">—</span>
              </td>
              <td class="nowrap">
                <span v-if="r.createdAt" :title="formatDate(r.createdAt)">{{ formatTimeline(r.createdAt) }}</span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="muted note">
        Window: {{ stats.rows }} newest rows<template v-if="feed.since"> since {{ formatDate(feed.since) }}</template>.
        <button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older reviews' }}</button>
        <span v-else>That is everything the source holds.</span>
      </p>
    </section>
  </template>
</template>
