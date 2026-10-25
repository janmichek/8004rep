<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { isAddress, type Address } from 'viem'
import { addressExplorerUrl, findChainBySlug, txExplorerUrl } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import ChainName from '../components/ChainName.vue'
import ChartSkeleton from '../components/ui/ChartSkeleton.vue'
import ColumnChart from '../components/ui/ColumnChart.vue'
import { COUNT_SERIES } from '../components/ui/palette'
import Skeleton from '../components/ui/Skeleton.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import StatTiles, { type Tile } from '../components/ui/StatTiles.vue'
import TilesSkeleton from '../components/ui/TilesSkeleton.vue'
import { sourceFor } from '../data'
import { dailyColumns, valueHistogram } from '../data/chartData'
import { loadFeedWindow, type FeedWindow } from '../data/feed'
import { fetchFunding } from '../data/funding'
import { buildReviewerProfile, LABEL_INFO } from '../data/reviewerProfile'
import { MIN_NONCE } from '../data/txChecks'
import { errorMessage, formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../format'
import { toDisplayUrl } from '../data/metadata'
import FeedbackNote from '../components/FeedbackNote.vue'
import { useAsync } from '../useAsync'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

const props = defineProps<{ slug: string; address: string }>()
const chain = computed(() => findChainBySlug(props.slug)!)
const address = computed(() => (isAddress(props.address, { strict: false }) ? (props.address as Address) : undefined))

// The feed grows with "Load older"; wallet facts load once.
const feed = shallowRef<FeedWindow>()
const feedError = shallowRef<string>()
const loadingFeed = shallowRef(false)

async function loadFeed(extend = false): Promise<void> {
  if (!address.value) return
  const target = { chain: chain.value, address: address.value }
  loadingFeed.value = true
  feedError.value = undefined
  try {
    const { source } = await sourceFor(target.chain)
    const next = await loadFeedWindow(source, { client: target.address }, { minRows: 100, ...(extend && feed.value ? { from: feed.value } : {}) })
    if (target.chain === chain.value && target.address === address.value) feed.value = next
  } catch (err) {
    feedError.value = errorMessage(err)
  } finally {
    loadingFeed.value = false
  }
}
watch(
  () => [chain.value, address.value],
  () => {
    feed.value = undefined
    void loadFeed()
  },
  { immediate: true },
)

const wallet = useAsync(
  async () => {
    if (!address.value) return null
    const { rpcClient } = await sourceFor(chain.value)
    const { explorerApiUrl } = chain.value
    const [nonce, code, funding] = await Promise.allSettled([
      rpcClient.getTransactionCount({ address: address.value }),
      rpcClient.getCode({ address: address.value }),
      explorerApiUrl ? fetchFunding({ ...chain.value, explorerApiUrl }, address.value) : Promise.resolve(undefined),
    ])
    const bytecode = code.status === 'fulfilled' ? (code.value ?? '0x') : undefined
    return {
      nonce: nonce.status === 'fulfilled' ? nonce.value : undefined,
      kind: bytecode === undefined ? undefined : bytecode === '0x' ? 'wallet' : bytecode.toLowerCase().startsWith('0xef0100') ? 'wallet + 7702' : 'contract',
      funding: funding.status === 'fulfilled' ? funding.value : undefined,
      fundingError: funding.status === 'rejected' ? errorMessage(funding.reason) : undefined,
    }
  },
  () => [chain.value, address.value],
)

const profile = computed(() => (address.value && feed.value ? buildReviewerProfile(address.value, feed.value.items) : undefined))

const tiles = computed<Tile[]>(() => {
  const p = profile.value
  const w = wallet.data.value
  if (!p) return []
  return [
    { label: 'Feedback', value: String(p.rows), hint: p.revoked ? `${p.revoked} revoked` : 'none revoked', tone: 'main' },
    { label: 'Agents rated', value: String(p.agents), hint: p.perAgent[0] ? `most on #${p.perAgent[0].tokenId} (${p.perAgent[0].rows})` : '' },
    {
      label: 'Average given',
      value: formatNumber(p.average),
      hint: 'non-revoked feedback',
      meter: p.average === null || p.average === undefined ? undefined : { kind: 'gauge', value: p.average },
    },
    {
      label: 'Most common value',
      value: p.mode ? formatScore(p.mode.value) : '—',
      hint: p.mode ? `${formatPercent(p.mode.share)} of feedback` : '',
      tone: p.labels.includes('rubber-stamp') ? 'warn' : undefined,
      meter: p.mode ? { kind: 'gauge', value: p.mode.value } : undefined,
    },
    { label: 'Busiest 24h', value: String(p.peakPerDay), hint: 'feedback in one day', tone: p.labels.includes('bulk') ? 'warn' : undefined },
    {
      label: 'Wallet',
      value: w?.nonce === undefined ? '—' : `${w.nonce} tx`,
      hint: w?.kind ?? '',
      title: `Transactions sent. Under ${MIN_NONCE} is a fresh wallet.`,
      tone: w?.nonce !== undefined && w.nonce < MIN_NONCE ? 'warn' : undefined,
      loading: wallet.loading.value,
    },
  ]
})

const valueColumns = computed(() => valueHistogram((feed.value?.items ?? []).filter((r) => !r.revoked).map((r) => r.value)))
const timeColumns = computed(() =>
  dailyColumns(feed.value?.items ?? [], (r) => r.createdAt, () => 'count', ['count'], { count: 'feedback' }),
)

/** Sorts the full lists; the template slices afterwards so the top N stays correct. */
const agentRows = useSort(
  computed(() => profile.value?.perAgent ?? []),
  [
    { key: 'agent', value: (a) => a.agentName ?? `Agent #${a.tokenId}` },
    { key: 'reviews', value: (a) => a.rows, numeric: true },
    { key: 'average', value: (a) => a.average, numeric: true },
    { key: 'revoked', value: (a) => a.revoked, numeric: true },
  ],
)
const latestRows = useSort(
  computed(() => feed.value?.items ?? []),
  [
    { key: 'agent', value: (r) => r.agentName ?? `Agent #${r.tokenId}` },
    { key: 'value', value: (r) => r.value, numeric: true },
    { key: 'when', value: (r) => r.createdAt, numeric: true },
  ],
)

const { open } = useRowLink()

function agentRoute(tokenId: bigint) {
  return { name: 'agent', params: { slug: chain.value.slug, id: tokenId.toString() } }
}
</script>

<template>

  <section v-if="!address" class="state">
    <h1>Not an address</h1>
    <p class="muted">“{{ props.address }}” is not a 0x address.</p>
  </section>

  <template v-else>
    <div class="page-head">
      <h1>
        Reviewer
        <span class="address-mark mono">
          <AddressIdenticon :address="address" :size="28" />
          {{ shortAddress(address) }}
        </span>
      </h1>
      <p class="meta">
        <span class="mono">{{ address }}</span>
        <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">Explorer ↗</a>
      </p>
    </div>

    <p v-if="feedError" class="notice">Could not load its feedback: {{ feedError }} <button @click="loadFeed()">Retry</button></p>
    <div v-else-if="!profile" aria-busy="true" aria-live="polite">
      <span class="sr-only">Loading its feedback</span>
      <TilesSkeleton :count="6" />
      <div class="chart-grid">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>

    <template v-if="profile">
      <StatTiles :tiles="tiles" />

      <section class="panel">
        <h3>What its habits say</h3>
        <ul v-if="profile.labels.length" class="signals">
          <li v-for="label in profile.labels" :key="label" :class="`level-${LABEL_INFO[label].tone}`">
            <span class="signal-level">{{ LABEL_INFO[label].label }}</span> <span>{{ LABEL_INFO[label].rule }}</span>
          </li>
        </ul>
        <p v-else class="muted">No reviewer rule fired: varied values, more than one agent, no bulk days.</p>
        <p class="note">
          <template v-if="wallet.data.value?.funding">
            First funded by
            <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="address-mark mono">
              <AddressIdenticon :address="wallet.data.value.funding.funder" />
              {{ shortAddress(wallet.data.value.funding.funder) }}
            </a>
            <template v-if="wallet.data.value.funding.timestamp"> on {{ formatDate(wallet.data.value.funding.timestamp) }}</template>
            (<a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">tx ↗</a>).
            Other reviewers funded by the same address show up as a shared funder on an agent's Reviewers tab.
          </template>
          <Skeleton v-else-if="wallet.loading.value" width="18em" />
          <span v-else-if="!chain.explorerApiUrl" class="muted">Funding cannot be traced on <ChainName :chain-id="chain.chainId" :name="chain.name" /> (no explorer API that allows browser calls).</span>
          <span v-else-if="wallet.data.value?.fundingError" class="muted">Funding lookup failed: {{ wallet.data.value.fundingError }}</span>
          <span v-else-if="wallet.data.value && wallet.data.value.funding === null" class="muted">No incoming transfer among its first transactions.</span>
        </p>
        <p class="muted note">
          Based on {{ profile.rows }} rows<template v-if="feed?.since"> since {{ formatDate(feed.since) }} (log scan window)</template>.
          <button v-if="feed?.cursor" :disabled="loadingFeed" @click="loadFeed(true)">{{ loadingFeed ? 'Loading…' : 'Load older' }}</button>
        </p>
      </section>

      <div class="chart-grid">
        <ColumnChart title="Values it gave" :columns="valueColumns" :series="COUNT_SERIES" />
        <ColumnChart title="Feedback over time" :columns="timeColumns" :series="COUNT_SERIES" />
      </div>

      <section class="panel">
        <h3>Agents it rated</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Agent" :active="agentRows.state('agent')" @sort="agentRows.toggle('agent')" />
                <SortHeader label="Feedback" numeric :active="agentRows.state('reviews')" @sort="agentRows.toggle('reviews')" />
                <SortHeader label="Average" numeric :active="agentRows.state('average')" @sort="agentRows.toggle('average')" />
                <SortHeader label="Revoked" numeric :active="agentRows.state('revoked')" @sort="agentRows.toggle('revoked')" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in agentRows.sorted.value"
                :key="a.tokenId.toString()"
                class="row-link"
                role="link"
                tabindex="0"
                :aria-label="`Open ${a.agentName ?? `Agent #${a.tokenId}`}`"
                @click="open(agentRoute(a.tokenId), $event)"
                @keydown.enter.prevent="open(agentRoute(a.tokenId))"
                @keydown.space.prevent="open(agentRoute(a.tokenId))"
              >
                <td>
                  {{ a.agentName ?? `Agent #${a.tokenId}` }}
                  <small class="muted"> #{{ a.tokenId }}</small>
                </td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
                <td class="num">{{ a.revoked || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel">
        <h3>Latest Feedback</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <SortHeader label="Agent" :active="latestRows.state('agent')" @sort="latestRows.toggle('agent')" />
                <SortHeader label="Value" numeric :active="latestRows.state('value')" @sort="latestRows.toggle('value')" />
                <th>Tags</th>
                <th>Text</th>
                <th>File</th>
                <SortHeader label="When" numeric :active="latestRows.state('when')" @sort="latestRows.toggle('when')" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in latestRows.sorted.value.slice(0, 50)"
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
                <td class="num"><b>{{ formatScore(r.value) }}</b> <span v-if="r.revoked" class="chip">revoked</span></td>
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
                  <template v-if="r.createdAt">
                    <a v-if="r.txHash" :href="txExplorerUrl(chain, r.txHash)" target="_blank" rel="noopener noreferrer" :title="formatDate(r.createdAt)">
                      {{ formatTimeline(r.createdAt) }}
                    </a>
                    <span v-else :title="formatDate(r.createdAt)">{{ formatTimeline(r.createdAt) }}</span>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </template>
</template>
