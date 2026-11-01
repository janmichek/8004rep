<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { chainById } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import ChainName from '../components/ChainName.vue'
import FeedbackNote from '../components/FeedbackNote.vue'
import NetworkPicker from '../components/NetworkPicker.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { sourceFor } from '../data'
import { loadFeedWindow, type FeedWindow } from '../data/feed'
import { toDisplayUrl } from '../data/metadata'
import type { FeedbackEvent } from '../data/types'
import { networkEnv } from '../env'
import { formatDate, formatScore, formatTimeline, shortAddress } from '../format'
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
      return loadFeedWindow(source, {}, { minRows: 100, maxSteps: 6, ...(from ? { from } : {}) })
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

const items = computed<FeedbackEvent[]>(() =>
  Object.entries(windows.value).flatMap(([id, w]) => w.items.map((r) => ({ ...r, chainId: r.chainId ?? Number(id) }))),
)
const since = computed(() => (scope.all.value ? undefined : Object.values(windows.value)[0]?.since))
const hasMore = computed(() => Object.values(windows.value).some((w) => w.cursor))

const rows = useSort(items, [
  { key: 'agent', value: (r) => r.agentName ?? `Agent #${r.tokenId}` },
  { key: 'network', value: (r) => chainById(r.chainId ?? 0)?.shortName ?? '' },
  { key: 'reviewer', value: (r) => r.client.toLowerCase() },
  { key: 'value', value: (r) => r.value, numeric: true },
  { key: 'when', value: (r) => r.createdAt, numeric: true },
])

const { open } = useRowLink()

function chainSlug(r: FeedbackEvent): string {
  return chainById(r.chainId ?? 0)?.slug ?? props.slug
}
function agentRoute(r: FeedbackEvent) {
  return { name: 'agent', params: { slug: chainSlug(r), id: r.tokenId.toString() } }
}
function reviewerRoute(r: FeedbackEvent) {
  return { name: 'reviewer', params: { slug: chainSlug(r), address: r.client } }
}
</script>

<template>
  <div class="page-head">
    <h1>
      Feedbacks
      <small>
        <template v-if="scope.all.value">All networks · {{ networkEnv === 'testnet' ? 'Testnet' : 'Mainnet' }}</template>
        <ChainName v-else-if="single" :chain-id="single.chainId" :name="single.name" />
      </small>
    </h1>
    <p class="meta">
      Newest feedback left on agents {{ scope.all.value ? 'across these networks' : 'in this network' }}.
      <template v-if="since"> Since {{ formatDate(since) }}.</template>
    </p>
    <NetworkPicker class="scope-pick" route-name="feedbacks" :slug="slug" />
  </div>

  <p v-if="failed.length && loaded" class="notice">
    Could not load feedback on {{ failed.map((f) => f.chain.name).join(', ') }}; those networks are left out.
  </p>

  <p v-if="error" class="notice">Could not load feedback: {{ error }} <button @click="load()">Retry</button></p>
  <TableSkeleton
    v-else-if="!loaded"
    label="Loading feedback"
    :headers="scope.all.value ? ['Network', 'Agent', 'Reviewer', 'Value', 'Tags', 'Text', 'When'] : ['Agent', 'Reviewer', 'Value', 'Tags', 'Text', 'When']"
    :numeric="['Value']"
  />

  <template v-else>
    <p v-if="!items.length" class="state muted">No feedback found on these networks.</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <SortHeader v-if="scope.all.value" label="Network" :active="rows.state('network')" @sort="rows.toggle('network')" />
            <SortHeader label="Agent" :active="rows.state('agent')" @sort="rows.toggle('agent')" />
            <SortHeader label="Reviewer" :active="rows.state('reviewer')" @sort="rows.toggle('reviewer')" />
            <SortHeader label="Value" numeric :active="rows.state('value')" @sort="rows.toggle('value')" />
            <th>Tags</th>
            <th>Text</th>
            <SortHeader label="When" numeric :active="rows.state('when')" @sort="rows.toggle('when')" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in rows.sorted.value"
            :key="i"
            class="row-link"
            :class="{ revoked: r.revoked }"
            role="link"
            tabindex="0"
            :aria-label="`Open ${r.agentName ?? `Agent #${r.tokenId}`}`"
            @click="open(agentRoute(r), $event)"
            @keydown.enter.prevent="open(agentRoute(r))"
            @keydown.space.prevent="open(agentRoute(r))"
          >
            <td v-if="scope.all.value">
              <ChainName v-if="chainById(r.chainId ?? 0)" :chain-id="r.chainId" :name="chainById(r.chainId ?? 0)!.name" />
            </td>
            <td>{{ r.agentName ?? `Agent #${r.tokenId}` }} <small class="muted">#{{ r.tokenId }}</small></td>
            <td>
              <RouterLink :to="reviewerRoute(r)" class="address-mark mono" @click.stop>
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
              <a v-if="toDisplayUrl(r.feedbackURI)" :href="toDisplayUrl(r.feedbackURI)" target="_blank" rel="noopener noreferrer">
                · file ↗
              </a>
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
      <button v-if="hasMore" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older feedback' }}</button>
      <span v-else>That is everything the source holds.</span>
    </p>
  </template>
</template>
