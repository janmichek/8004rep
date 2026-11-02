<script setup lang="ts">
import { MessagesSquare } from '@lucide/vue'
import { computed } from 'vue'
import { chainById, networkNames } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import NetworkPicker from '../components/NetworkPicker.vue'
import Hint from '../components/ui/Hint.vue'
import PageHeader, { type PageFact } from '../components/ui/PageHeader.vue'
import ReviewerChip from '../components/ui/ReviewerChip.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { reviewerDirectory } from '../data/directory'
import { LABEL_INFO, type ReviewerProfile } from '../data/reviewerProfile'
import { formatNumber, shortAddress } from '../format'
import { useScope } from '../scope'
import { useFeedRows } from '../useFeedRows'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

const props = defineProps<{ slug: string }>()
const scope = useScope(() => props.slug)

const { rows: feedRows, hasMore, loaded, failed, error, loading, load } = useFeedRows(scope, { minRows: 250, maxSteps: 12 })

const reviewers = computed<ReviewerProfile[]>(() => reviewerDirectory(feedRows.value))
const flagged = computed(() => reviewers.value.filter((r) => r.labels.length).length)

const facts = computed<PageFact[]>(() => {
  if (!loaded.value) return []
  return [
    { value: reviewers.value.length.toLocaleString(), label: 'reviewers' },
    { value: feedRows.value.length.toLocaleString(), label: 'feedback rows' },
    ...(flagged.value ? [{ value: flagged.value.toLocaleString(), label: 'flagged', tone: 'warn' as const }] : []),
  ]
})

const note = 'Built from the newest feedback rows. Flags use the same rules as Network health; a flag is a prompt to look closer, not a verdict.'

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
</script>

<template>
  <PageHeader
    title="Reviewers"
    description="Addresses that rated agents in the latest feedback, with the flags the rules raise."
    :icon="MessagesSquare"
    :facts="facts"
    :note="note"
    :loading="loading && !loaded"
  >
    <template #actions>
      <NetworkPicker route-name="reviewers" :slug="slug" />
    </template>
  </PageHeader>

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
            <td v-if="scope.all.value" :title="networkNames(r.chainIds)">{{ networkNames(r.chainIds) }}</td>
            <td class="num">{{ formatNumber(r.average) }}</td>
            <td>
              <Hint v-for="l in r.labels" :key="l" :text="LABEL_INFO[l].rule">
                <ReviewerChip :label="l" />
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
