<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChainInfo } from '../../chains'
import type { FeedbackStats } from '../../data/feedbackStats'
import type { AgentDetail } from '../../data/types'
import FeedbackList, { type ListRow } from '../FeedbackList.vue'
import TxDetail from '../TxDetail.vue'

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
const sort = ref<'newest' | 'value' | 'weight'>('newest')

const all = computed<ListRow[]>(() => props.agent.feedback.map((row, index) => ({ row, stats: props.stats.rows[index], index })))
const counts = computed(() => Object.fromEntries(FILTERS.map((f) => [f.id, all.value.filter(f.test).length])))
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
    <div class="segmented" role="group" aria-label="Filter rows">
      <button v-for="f in FILTERS" :key="f.id" :class="{ active: filter === f.id }" :disabled="counts[f.id] === 0 && f.id !== 'all'" @click="filter = f.id">
        {{ f.label }} <span class="muted">{{ counts[f.id] }}</span>
      </button>
    </div>
    <label class="sort">
      Sort
      <select v-model="sort">
        <option value="newest">newest</option>
        <option value="value">value</option>
        <option value="weight">lowest weight</option>
      </select>
    </label>
  </div>
  <FeedbackList :rows="rows" :chain="chain" :reviewer-route="reviewerRoute">
    <template #detail="{ row, index }">
      <TxDetail :chain="chain" :agent="agent" :row="row" :index="index" :stats="stats" />
    </template>
  </FeedbackList>
</template>
