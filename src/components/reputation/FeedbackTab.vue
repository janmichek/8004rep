<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChainInfo } from '../../chains'
import type { FeedbackStats } from '../../data/feedbackStats'
import type { AgentDetail } from '../../data/types'
import FeedbackList, { type ListRow } from '../FeedbackList.vue'
import TxDetail from '../TxDetail.vue'
import Segmented, { type Segment } from '../ui/Segmented.vue'
import SelectMenu from '../ui/SelectMenu.vue'

const props = defineProps<{ agent: AgentDetail; chain: ChainInfo; stats: FeedbackStats }>()

type Filter = 'all' | 'full' | 'flagged' | 'revoked' | 'replied'
const FILTERS: { id: Filter; label: string; test: (r: ListRow) => boolean }[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'full', label: 'Full weight', test: (r) => !r.row.revoked && r.stats!.weight === 1 },
  { id: 'flagged', label: 'Discounted', test: (r) => !r.row.revoked && r.stats!.weight < 1 },
  { id: 'revoked', label: 'Revoked', test: (r) => r.row.revoked },
  { id: 'replied', label: 'With replies', test: (r) => Boolean(r.row.responses?.length) },
]
const filter = ref<Filter>('all')
const sort = ref('newest')
const SORTS = [
  { value: 'newest', label: 'newest' },
  { value: 'value', label: 'value' },
  { value: 'weight', label: 'lowest weight' },
]

const all = computed<ListRow[]>(() => props.agent.feedback.map((row, index) => ({ row, stats: props.stats.rows[index], index })))
const counts = computed(() => Object.fromEntries(FILTERS.map((f) => [f.id, all.value.filter(f.test).length])))
const segments = computed<Segment[]>(() =>
  FILTERS.map((f) => ({
    id: f.id,
    label: f.label,
    count: counts.value[f.id],
    disabled: counts.value[f.id] === 0 && f.id !== 'all',
  })),
)
const rows = computed(() => {
  const picked = all.value.filter(FILTERS.find((f) => f.id === filter.value)!.test)
  if (sort.value === 'value') return [...picked].sort((a, b) => b.row.value - a.row.value)
  if (sort.value === 'weight') return [...picked].sort((a, b) => a.stats!.weight - b.stats!.weight)
  return picked
})

function reviewerRoute(address: string) {
  return { name: 'reviewer', params: { slug: props.chain.slug, address } }
}
</script>

<template>
  <div class="toolbar">
    <Segmented v-model="filter" label="Filter rows" :segments="segments" />
    <label class="sort">
      Sort
      <SelectMenu v-model="sort" compact label="Sort feedback" :options="SORTS" />
    </label>
  </div>
  <FeedbackList :rows="rows" :chain="chain" :reviewer-route="reviewerRoute">
    <template #detail="{ row, index }">
      <TxDetail :chain="chain" :agent="agent" :row="row" :index="index" :stats="stats" />
    </template>
  </FeedbackList>
</template>
