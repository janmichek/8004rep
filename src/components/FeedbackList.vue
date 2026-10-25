<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../chains'
import { FLAG_INFO, type RowStats } from '../data/feedbackStats'
import { KIND_INFO } from '../data/reputation/kinds'
import { toDisplayUrl } from '../data/metadata'
import type { Feedback } from '../data/types'
import AddressIdenticon from './AddressIdenticon.vue'
import FeedbackNote from './FeedbackNote.vue'
import FlagChip from './ui/FlagChip.vue'
import Hint from './ui/Hint.vue'
import SortHeader from './ui/SortHeader.vue'
import { formatDate, formatNumber, formatScore, formatTimeline, shortAddress } from '../format'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

export type ListRow = { row: Feedback; stats?: RowStats; index: number }

// `index` points into the agent's full feedback, which the detail route needs.
const props = defineProps<{
  rows: ListRow[]
  chain: ChainInfo
  reviewerRoute?: (address: string) => RouteLocationRaw
  detailRoute?: (index: number) => RouteLocationRaw
}>()

const { open } = useRowLink()
const hasStats = computed(() => props.rows.some((r) => r.stats))
const hasNotes = computed(() => props.rows.some((r) => r.row.feedbackURI))

const { sorted: sortedRows, state: sortState, toggle: toggleSort } = useSort(
  () => props.rows,
  [
    { key: 'reviewer', value: (r) => r.row.client },
    { key: 'value', value: (r) => r.row.value, numeric: true },
    { key: 'tags', value: (r) => r.row.tag1 },
    { key: 'weight', value: (r) => r.stats?.weight, numeric: true },
    { key: 'when', value: (r) => r.row.createdAt, numeric: true },
    { key: 'replies', value: (r) => r.row.responses?.length, numeric: true },
  ],
)

function evidenceUrl(uri: string | undefined): string | undefined {
  return uri && !/^data:/i.test(uri) ? toDisplayUrl(uri) : undefined
}

function openDetail(index: number, event?: Event): void {
  open(props.detailRoute?.(index), event)
}
</script>

<template>
  <p v-if="rows.length === 0" class="muted">No feedback match.</p>
  <div v-else class="table-wrap">
    <table class="feedback-table">
      <thead>
        <tr>
          <SortHeader label="Reviewer" :active="sortState('reviewer')" @sort="toggleSort('reviewer')" />
          <SortHeader label="Value" numeric :active="sortState('value')" @sort="toggleSort('value')" />
          <SortHeader label="Tags" :active="sortState('tags')" @sort="toggleSort('tags')" />
          <Hint v-if="hasNotes" text="The text (or comment) field of the off-chain feedback file"><th>Text</th></Hint>
          <SortHeader
            v-if="hasStats"
            label="Weight"
            text="Authenticity weight (1 = full vote) and the rules that fired; hover a chip for its rule"
            :active="sortState('weight')"
            @sort="toggleSort('weight')"
          />
          <th>Link</th>
          <SortHeader label="When" numeric :active="sortState('when')" @sort="toggleSort('when')" />
          <SortHeader
            label="Replies"
            text="appendResponse entries: agent replies, refunds, spam flags"
            numeric
            :active="sortState('replies')"
            @sort="toggleSort('replies')"
          />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="{ row, stats, index } in sortedRows"
          :key="index"
          :class="{ revoked: row.revoked, 'row-link': detailRoute }"
          :role="detailRoute ? 'link' : undefined"
          :tabindex="detailRoute ? 0 : undefined"
          :aria-label="detailRoute ? `Open feedback detail #${index}` : undefined"
          @click="detailRoute && openDetail(index, $event)"
          @keydown.enter.prevent="detailRoute && openDetail(index)"
          @keydown.space.prevent="detailRoute && openDetail(index)"
        >
            <td class="nowrap">
              <RouterLink v-if="reviewerRoute" :to="reviewerRoute(row.client)" class="address-mark mono" :title="row.client">
                <AddressIdenticon :address="row.client" />
                {{ shortAddress(row.client) }}
              </RouterLink>
              <a v-else :href="addressExplorerUrl(chain, row.client)" target="_blank" rel="noopener noreferrer" class="address-mark mono">
                <AddressIdenticon :address="row.client" />
                {{ shortAddress(row.client) }}
              </a>
              <small v-if="row.index !== undefined" class="muted" title="Feedback index of this reviewer on this agent"> #{{ row.index }}</small>
            </td>
            <td class="num">
              <b>{{ formatScore(row.value) }}</b>
              <FlagChip v-if="row.revoked" flag="revoked" />
              <Hint v-if="stats && stats.kind !== 'rating'" :text="KIND_INFO[stats.kind].rule">
                <span class="chip">{{ KIND_INFO[stats.kind].label }}</span>
              </Hint>
              <Hint v-else-if="stats && stats.rating === null" text="A rating whose value fits no inferred scale; listed, never scored.">
                <span class="chip warn">off-scale</span>
              </Hint>
            </td>
            <td class="tags">
              <span v-if="row.tag1" class="chip clip-chip" :title="row.tag1">{{ row.tag1 }}</span>
              <span v-if="row.tag2" class="chip clip-chip" :title="row.tag2">{{ row.tag2 }}</span>
            </td>
            <td v-if="hasNotes">
              <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
              <span v-else class="muted">—</span>
            </td>
            <td v-if="hasStats" class="checks-cell">
              <template v-if="stats">
                <Hint text="Authenticity weight">
                  <span class="weight" :class="{ low: stats.weight < 0.5 }">{{ formatNumber(stats.weight, 2) }}</span>
                </Hint>
                <template v-for="flag in stats.flags" :key="flag">
                  <Hint v-if="flag !== 'revoked'" :text="FLAG_INFO[flag].rule">
                    <FlagChip :flag="flag" />
                  </Hint>
                </template>
              </template>
            </td>
            <td class="links">
              <div class="link-row">
              <a
                v-if="row.txHash"
                :href="txExplorerUrl(chain, row.txHash)"
                target="_blank"
                rel="noopener noreferrer"
                title="Open the transaction"
              >
                tx ↗
              </a>
              <span v-else class="muted">—</span>
              <a v-if="evidenceUrl(row.feedbackURI)" :href="evidenceUrl(row.feedbackURI)" target="_blank" rel="noopener noreferrer" title="Feedback file (feedbackURI)">
                · file ↗
              </a>
              </div>
              <span v-if="row.endpoint" class="endpoint ellipsis" :title="row.endpoint">{{ row.endpoint }}</span>
            </td>
            <td class="nowrap">
              <span v-if="row.createdAt" :title="formatDate(row.createdAt)">{{ formatTimeline(row.createdAt) }}</span>
              <span v-else class="muted" title="Older than the log scan window, or the source has no dates">—</span>
            </td>
            <td>
              <span
                v-if="row.responses?.length"
                class="chip accent"
                :title="row.responses.map((r) => `${shortAddress(r.responder)}${r.uri ? ` → ${r.uri}` : ''}`).join('\n')"
              >
                ↩ {{ row.responses.length }}
              </span>
            </td>
          </tr>
      </tbody>
    </table>
  </div>
</template>
