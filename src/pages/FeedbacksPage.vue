<script setup lang="ts">
import { MessageSquareText } from '@lucide/vue'
import { computed } from 'vue'
import { chainById } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import ChainName from '../components/ChainName.vue'
import FeedbackNote from '../components/FeedbackNote.vue'
import NetworkPicker from '../components/NetworkPicker.vue'
import PageHeader, { type PageFact } from '../components/ui/PageHeader.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { toDisplayUrl } from '../data/metadata'
import type { FeedbackEvent } from '../data/types'
import { formatDate, formatScore, formatTimeline, shortAddress } from '../format'
import { useScope } from '../scope'
import { useFeedRows } from '../useFeedRows'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

const props = defineProps<{ slug: string }>()
const scope = useScope(() => props.slug)

const { rows: items, hasMore, since, loaded, failed, error, loading, load } = useFeedRows(scope, { minRows: 100, maxSteps: 6 })

const agentCount = computed(() => new Set(items.value.map((r) => `${r.chainId ?? 0}:${r.tokenId}`)).size)
const reviewerCount = computed(() => new Set(items.value.map((r) => r.client.toLowerCase())).size)

const facts = computed<PageFact[]>(() => {
  if (!loaded.value) return []
  return [
    { value: items.value.length.toLocaleString(), label: 'feedback rows' },
    { value: agentCount.value.toLocaleString(), label: 'agents rated' },
    { value: reviewerCount.value.toLocaleString(), label: 'reviewers' },
  ]
})

const note = computed(() => (since.value ? `Newest rows since ${formatDate(since.value)}.` : undefined))

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
  <PageHeader
    title="Feedbacks"
    description="Every review left on the newest agents, one row per feedback."
    :icon="MessageSquareText"
    :facts="facts"
    :note="note"
    :loading="loading && !loaded"
  >
    <template #actions>
      <NetworkPicker route-name="feedbacks" :slug="slug" />
    </template>
  </PageHeader>

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
            :key="`${r.chainId ?? 0}:${r.tokenId}:${r.client}:${r.index ?? `i${i}`}`"
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
