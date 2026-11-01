<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { chainById } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import ChainName from '../components/ChainName.vue'
import NetworkPicker from '../components/NetworkPicker.vue'
import Hint from '../components/ui/Hint.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { sourceFor } from '../data'
import { loadFeedWindow, type FeedWindow } from '../data/feed'
import { reviewerDirectory } from '../data/directory'
import { LABEL_INFO, type ReviewerProfile } from '../data/reviewerProfile'
import type { FeedbackEvent } from '../data/types'
import { networkEnv } from '../env'
import { formatNumber, shortAddress } from '../format'
import { loadChains, useScope, type ChainFailure } from '../scope'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

const props = defineProps<{ slug: string }>()
const scope = useScope(() => props.slug)
const single = computed(() => (scope.all.value ? undefined : scope.chains.value[0]))

/** Feed window per chain id; each row is tagged with its chain. */
const windows = shallowRef<Record<number, FeedWindow>>({})
const loaded = shallowRef(false)
const failed = shallowRef<ChainFailure[]>([])
const error = shallowRef<string>()
const loading = shallowRef(false)

let run = 0
async function load(extend = false): Promise<void> {
  const current = ++run
  const targets = scope.chains.value
  loading.value = true
  error.value = undefined
  try {
    const result = await loadChains(targets, async (chain) => {
      const { source } = await sourceFor(chain)
      const from = extend ? windows.value[chain.chainId] : undefined
      return loadFeedWindow(source, {}, { minRows: 250, maxSteps: 12, ...(from ? { from } : {}) })
    })
    if (current !== run) return
    failed.value = result.failed
    if (!result.values.length && result.failed.length) {
      error.value = `${result.failed[0].chain.name}: ${result.failed[0].message}`
      return
    }
    const next: Record<number, FeedWindow> = extend ? { ...windows.value } : {}
    for (const { chain, value } of result.values) next[chain.chainId] = value
    windows.value = next
    loaded.value = true
  } finally {
    if (current === run) loading.value = false
  }
}

watch(
  scope.key,
  () => {
    windows.value = {}
    loaded.value = false
    void load()
  },
  { immediate: true },
)

const feedRows = computed<FeedbackEvent[]>(() =>
  Object.entries(windows.value).flatMap(([id, w]) => w.items.map((r) => ({ ...r, chainId: r.chainId ?? Number(id) }))),
)
const reviewers = computed<ReviewerProfile[]>(() => reviewerDirectory(feedRows.value))
const hasMore = computed(() => Object.values(windows.value).some((w) => w.cursor))

const rows = useSort(reviewers, [
  { key: 'reviewer', value: (r) => r.address.toLowerCase() },
  { key: 'reviews', value: (r) => r.rows, numeric: true },
  { key: 'agents', value: (r) => r.agents, numeric: true },
  { key: 'average', value: (r) => r.average, numeric: true },
  { key: 'flags', value: (r) => r.labels.length, numeric: true },
])

const { open } = useRowLink()

// Reviewer pages are per chain: a reviewer across networks opens on the chain with most of their rows.
function reviewerRoute(r: ReviewerProfile) {
  return { name: 'reviewer', params: { slug: chainById(r.chainIds[0] ?? 0)?.slug ?? props.slug, address: r.address } }
}
function networkNames(r: ReviewerProfile): string {
  return r.chainIds.map((id) => chainById(id)?.shortName ?? String(id)).join(', ')
}
</script>

<template>
  <div class="page-head">
    <h1>
      Reviewers
      <small>
        <template v-if="scope.all.value">All networks · {{ networkEnv === 'testnet' ? 'Testnet' : 'Mainnet' }}</template>
        <ChainName v-else-if="single" :chain-id="single.chainId" :name="single.name" />
      </small>
    </h1>
    <p class="meta">Addresses that left feedback in the latest rows {{ scope.all.value ? 'of these networks' : 'of this network' }}.</p>
    <NetworkPicker class="scope-pick" route-name="reviewers" :slug="slug" />
  </div>

  <p class="lede">
    Built from the newest feedback loaded
    <template v-if="feedRows.length">({{ feedRows.length.toLocaleString() }} rows)</template>. Flags use the same rules as
    Network health; a flag is a prompt to look closer, not a verdict.
  </p>

  <p v-if="failed.length && loaded" class="notice">
    Could not load feedback on {{ failed.map((f) => f.chain.name).join(', ') }}; those networks are left out.
  </p>

  <p v-if="error" class="notice">Could not load feedback: {{ error }} <button @click="load()">Retry</button></p>
  <TableSkeleton
    v-else-if="!loaded"
    label="Loading reviewers"
    :headers="scope.all.value ? ['Reviewer', 'Reviews', 'Agents', 'Networks', 'Average', 'Flags'] : ['Reviewer', 'Reviews', 'Agents', 'Average', 'Flags']"
    :numeric="['Reviews', 'Agents', 'Average']"
  />

  <template v-else>
    <p v-if="!reviewers.length" class="state muted">No reviewers in the loaded feedback.</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader label="Reviewer" :active="rows.state('reviewer')" @sort="rows.toggle('reviewer')" />
            <SortHeader label="Reviews" numeric :active="rows.state('reviews')" @sort="rows.toggle('reviews')" />
            <SortHeader label="Agents" numeric :active="rows.state('agents')" @sort="rows.toggle('agents')" />
            <th v-if="scope.all.value">Networks</th>
            <SortHeader label="Average" numeric :active="rows.state('average')" @sort="rows.toggle('average')" />
            <SortHeader label="Flags" :active="rows.state('flags')" @sort="rows.toggle('flags')" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows.sorted.value"
            :key="r.address"
            class="row-link"
            role="link"
            tabindex="0"
            :aria-label="`Open reviewer ${shortAddress(r.address)}`"
            @click="open(reviewerRoute(r), $event)"
            @keydown.enter.prevent="open(reviewerRoute(r))"
            @keydown.space.prevent="open(reviewerRoute(r))"
          >
            <td>
              <span class="address-mark mono" :title="r.address">
                <AddressIdenticon :address="r.address" />
                {{ shortAddress(r.address) }}
              </span>
            </td>
            <td class="num">{{ r.rows }}</td>
            <td class="num">{{ r.agents }}</td>
            <td v-if="scope.all.value" :title="networkNames(r)">{{ networkNames(r) }}</td>
            <td class="num">{{ formatNumber(r.average) }}</td>
            <td>
              <Hint v-for="l in r.labels" :key="l" :text="LABEL_INFO[l].rule">
                <span class="chip" :class="LABEL_INFO[l].tone === 'warn' ? 'warn' : ''">{{ LABEL_INFO[l].label }}</span>
              </Hint>
              <span v-if="!r.labels.length" class="muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="muted note">
      <button v-if="hasMore" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older feedback' }}</button>
      <span v-else>That is everything the source holds.</span>
    </p>
  </template>
</template>
