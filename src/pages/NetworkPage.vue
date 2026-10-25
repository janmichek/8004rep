<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { findChainBySlug } from '../chains'
import ChainName from '../components/ChainName.vue'
import ChartSkeleton from '../components/ui/ChartSkeleton.vue'
import ColumnChart from '../components/ui/ColumnChart.vue'
import Hint from '../components/ui/Hint.vue'
import { COUNT_SERIES, WEIGHT_SERIES } from '../components/ui/palette'
import SortHeader from '../components/ui/SortHeader.vue'
import StatTiles, { type Tile } from '../components/ui/StatTiles.vue'
import TilesSkeleton from '../components/ui/TilesSkeleton.vue'
import TabBar, { type Tab } from '../components/ui/TabBar.vue'
import { sourceFor } from '../data'
import { dailyColumns, valueHistogram } from '../data/chartData'
import { loadFeedWindow, type FeedWindow } from '../data/feed'
import { computeNetworkStats } from '../data/networkStats'
import { LABEL_INFO } from '../data/reviewerProfile'
import { fetchScanStats } from '../data/scan'
import { errorMessage, formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../format'
import { toDisplayUrl } from '../data/metadata'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import FeedbackNote from '../components/FeedbackNote.vue'
import { useAsync } from '../useAsync'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

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
    { label: 'Feedback in window', value: String(s.rows), hint: s.from && s.to ? daySpan(s.from, s.to) : '', tone: 'main' },
    { label: 'Agents rated', value: String(s.agents) },
    { label: 'Reviewers', value: String(s.reviewers), hint: `${formatNumber(s.rows / Math.max(1, s.reviewers))} feedback each` },
    {
      label: 'Average value',
      value: formatNumber(s.average),
      hint: [
        'ratings only, normalised',
        ecosystem.data.value ? `ecosystem raw mean ${formatNumber(ecosystem.data.value.averageFeedback)}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      meter: s.average === null || s.average === undefined ? undefined : { kind: 'gauge', value: s.average },
    },
    {
      label: 'Perfect 100s',
      value: formatPercent(s.perfectShare),
      hint: 'of scored ratings at 99%+',
      tone: (s.perfectShare ?? 0) > 0.7 ? 'warn' : undefined,
      title: 'A network where most feedback is 100 cannot tell good agents from great ones',
      meter: s.perfectShare === null || s.perfectShare === undefined ? undefined : { kind: 'gauge', value: s.perfectShare * 100 },
    },
    {
      label: 'Suspect reviewers',
      value: String(s.suspects.length),
      hint: `${s.lookalikes.length} lookalike groups`,
      tone: s.suspects.length ? 'warn' : 'good',
      meter: { kind: 'severity', level: s.suspects.length ? Math.min(3, s.suspects.length > 20 ? 3 : s.suspects.length > 5 ? 2 : 1) : 0, max: 3 },
    },
  ]
})

const volume = computed(() =>
  dailyColumns(
    feed.value?.items ?? [],
    (r) => r.createdAt,
    (r) => (r.revoked ? 'revoked' : 'clean'),
    ['clean', 'revoked'],
    { clean: 'live', revoked: 'revoked' },
  ),
)
const VOLUME_SERIES = [
  { ...WEIGHT_SERIES[0], label: 'live', color: COUNT_SERIES[0].color },
  WEIGHT_SERIES[3],
]
const distribution = computed(() => valueHistogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value)))

/** Sorts the full lists; the template slices afterwards so the top N stays correct. */
const suspectRows = useSort(
  computed(() => stats.value?.suspects ?? []),
  [
    { key: 'reviewer', value: (s) => s.client },
    { key: 'reviews', value: (s) => s.rows, numeric: true },
    { key: 'agents', value: (s) => s.agents, numeric: true },
    { key: 'average', value: (s) => s.average, numeric: true },
  ],
)
const topAgentRows = useSort(
  computed(() => stats.value?.topAgents ?? []),
  [
    { key: 'agent', value: (a) => a.agentName ?? `Agent #${a.tokenId}` },
    { key: 'reviews', value: (a) => a.rows, numeric: true },
    { key: 'reviewers', value: (a) => a.reviewers, numeric: true },
    { key: 'average', value: (a) => a.average, numeric: true },
  ],
)
const latestRows = useSort(
  computed(() => feed.value?.items ?? []),
  [
    { key: 'agent', value: (r) => r.agentName ?? `Agent #${r.tokenId}` },
    { key: 'reviewer', value: (r) => r.client },
    { key: 'value', value: (r) => r.value, numeric: true },
    { key: 'when', value: (r) => r.createdAt, numeric: true },
  ],
)

const tabs = computed<Tab[]>(() => [
  { id: 'suspects', label: 'Suspect reviewers', count: stats.value?.suspects.length ?? 0, ...(stats.value?.suspects.length ? { tone: 'warn' as const } : {}) },
  { id: 'lookalikes', label: 'Lookalike agents', count: stats.value?.lookalikes.length ?? 0 },
  { id: 'agents', label: 'Busiest agents', count: stats.value?.topAgents.length ?? 0 },
  { id: 'latest', label: 'Latest Feedback' },
])

const { open } = useRowLink()

function agentRoute(tokenId: bigint) {
  return { name: 'agent', params: { slug: chain.value.slug, id: tokenId.toString() } }
}
function reviewerRoute(address: string) {
  return { name: 'reviewer', params: { slug: chain.value.slug, address } }
}
</script>

<template>
  <div class="page-head">
    <h1><ChainName :chain-id="chain.chainId" :name="chain.name" :size="22" /> <small>feedback health</small></h1>
  </div>
  <p class="lede">
    Patterns across the latest feedback of the network. Everything is computed from the rows loaded here — load older rows to widen the window.
  </p>

  <p v-if="error" class="notice">Could not load the feed: {{ error }} <button @click="load()">Retry</button></p>
  <div v-else-if="!stats" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading the latest feedback</span>
    <TilesSkeleton :count="6" />
    <div class="chart-grid">
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  </div>

  <template v-if="stats && feed">
    <StatTiles :tiles="tiles" />
    <p class="muted note">
      Window: {{ stats.rows }} newest rows<template v-if="feed.since"> since {{ formatDate(feed.since) }}</template>.
      <button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older feedback' }}</button>
      <span v-else>That is everything the source holds.</span>
    </p>

    <div class="chart-grid">
      <ColumnChart title="Feedback volume" :columns="volume" :series="VOLUME_SERIES" />
      <ColumnChart
        title="Values given (non-revoked)"
        :columns="distribution"
        :series="COUNT_SERIES"
        :marker="ecosystem.data.value ? { at: ecosystem.data.value.averageFeedback, label: `ecosystem avg ${formatNumber(ecosystem.data.value.averageFeedback)}` } : undefined"
      />
    </div>

    <TabBar :tabs="tabs" label="Network views">
      <template #suspects>
        <p v-if="!stats.suspects.length" class="muted">No reviewer in this window trips a reviewer rule.</p>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Reviewer" :active="suspectRows.state('reviewer')" @sort="suspectRows.toggle('reviewer')" />
                <SortHeader label="Reviews" numeric :active="suspectRows.state('reviews')" @sort="suspectRows.toggle('reviews')" />
                <SortHeader label="Agents" numeric :active="suspectRows.state('agents')" @sort="suspectRows.toggle('agents')" />
                <SortHeader label="Average" numeric :active="suspectRows.state('average')" @sort="suspectRows.toggle('average')" />
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in suspectRows.sorted.value.slice(0, 50)"
                :key="s.client"
                class="row-link"
                role="link"
                tabindex="0"
                :aria-label="`Open reviewer ${shortAddress(s.client)}`"
                @click="open(reviewerRoute(s.client), $event)"
                @keydown.enter.prevent="open(reviewerRoute(s.client))"
                @keydown.space.prevent="open(reviewerRoute(s.client))"
              >
                <td>
                  <span class="address-mark mono" :title="s.client">
                    <AddressIdenticon :address="s.client" />
                    {{ shortAddress(s.client) }}
                  </span>
                </td>
                <td class="num">{{ s.rows }}</td>
                <td class="num">{{ s.agents }}</td>
                <td class="num">{{ formatNumber(s.average) }}</td>
                <td>
                  <Hint v-for="l in s.labels" :key="l" :text="LABEL_INFO[l].rule">
                    <span class="chip" :class="LABEL_INFO[l].tone === 'warn' ? 'warn' : ''">
                      {{ LABEL_INFO[l].label }}
                    </span>
                  </Hint>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template #lookalikes>
        <p class="muted note">Agents rated by nearly the same set of reviewers (overlap ≥ 80%, at least 2 shared). One crowd reviewing several agents together is how feedback rings and agent farms look — and also how a test suite looks.</p>
        <p v-if="!stats.lookalikes.length" class="muted">No lookalike groups in this window.</p>
        <ul v-else class="groups">
          <li v-for="(g, i) in stats.lookalikes.slice(0, 30)" :key="i" class="panel">
            <b>{{ g.agents.length }} agents</b> · {{ g.reviewers.length }} shared reviewers · overlap {{ formatPercent(g.similarity) }}
            <div>
              <RouterLink v-for="a in g.agents" :key="a.tokenId.toString()" :to="agentRoute(a.tokenId)" class="chip">
                {{ a.agentName ?? `#${a.tokenId}` }}
              </RouterLink>
            </div>
            <small class="muted">
              Reviewers:
              <RouterLink v-for="r in g.reviewers.slice(0, 8)" :key="r" :to="reviewerRoute(r)" class="address-mark mono">
                <AddressIdenticon :address="r" />
                {{ shortAddress(r) }}
              </RouterLink>
              <template v-if="g.reviewers.length > 8"> +{{ g.reviewers.length - 8 }}</template>
            </small>
          </li>
        </ul>
      </template>

      <template #agents>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Agent" :active="topAgentRows.state('agent')" @sort="topAgentRows.toggle('agent')" />
                <SortHeader label="Feedback" numeric :active="topAgentRows.state('reviews')" @sort="topAgentRows.toggle('reviews')" />
                <SortHeader label="Reviewers" numeric :active="topAgentRows.state('reviewers')" @sort="topAgentRows.toggle('reviewers')" />
                <SortHeader label="Average" numeric :active="topAgentRows.state('average')" @sort="topAgentRows.toggle('average')" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in topAgentRows.sorted.value"
                :key="a.tokenId.toString()"
                class="row-link"
                role="link"
                tabindex="0"
                :aria-label="`Open ${a.agentName ?? `Agent #${a.tokenId}`}`"
                @click="open(agentRoute(a.tokenId), $event)"
                @keydown.enter.prevent="open(agentRoute(a.tokenId))"
                @keydown.space.prevent="open(agentRoute(a.tokenId))"
              >
                <td>{{ a.agentName ?? `Agent #${a.tokenId}` }} <small class="muted">#{{ a.tokenId }}</small></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num" :class="{ warnText: a.reviewers === 1 && a.rows > 2 }">{{ a.reviewers }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template #latest>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Agent" :active="latestRows.state('agent')" @sort="latestRows.toggle('agent')" />
                <SortHeader label="Reviewer" :active="latestRows.state('reviewer')" @sort="latestRows.toggle('reviewer')" />
                <SortHeader label="Value" numeric :active="latestRows.state('value')" @sort="latestRows.toggle('value')" />
                <th>Tags</th>
                <th>Text</th>
                <th>File</th>
                <SortHeader label="When" numeric :active="latestRows.state('when')" @sort="latestRows.toggle('when')" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in latestRows.sorted.value.slice(0, 100)"
                :key="i"
                class="row-link"
                :class="{ revoked: r.revoked }"
                role="link"
                tabindex="0"
                :aria-label="`Open ${r.agentName ?? `Agent #${r.tokenId}`}`"
                @click="open(agentRoute(r.tokenId), $event)"
                @keydown.enter.prevent="open(agentRoute(r.tokenId))"
                @keydown.space.prevent="open(agentRoute(r.tokenId))"
              >
                <td>{{ r.agentName ?? `Agent #${r.tokenId}` }}</td>
                <td>
                  <RouterLink :to="reviewerRoute(r.client)" class="address-mark mono">
                    <AddressIdenticon :address="r.client" />
                    {{ shortAddress(r.client) }}
                  </RouterLink>
                </td>
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
                  <a v-if="toDisplayUrl(r.feedbackURI)" :href="toDisplayUrl(r.feedbackURI)" target="_blank" rel="noopener noreferrer" title="Feedback file (effchain file)">
                    · file ↗
                  </a>
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
      </template>
    </TabBar>
  </template>
</template>
