<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../chains'
import { FLAG_INFO, type RowStats } from '../data/feedbackStats'
import { toDisplayUrl } from '../data/metadata'
import type { Feedback } from '../data/types'
import FeedbackNote from './FeedbackNote.vue'
import { formatDate, formatNumber, formatScore, formatTimeline, shortAddress } from '../format'

export type ListRow = { row: Feedback; stats?: RowStats; index: number }

// `index` points into the agent's full feedback, which the detail slot needs.
const props = defineProps<{ rows: ListRow[]; chain: ChainInfo; reviewerRoute?: (address: string) => RouteLocationRaw }>()

// A `detail` slot makes rows expandable: it renders under the open row, one at a time.
const slots = useSlots()
const open = ref<number>()
const hasStats = computed(() => props.rows.some((r) => r.stats))
const columns = computed(() => 6 + (hasStats.value ? 1 : 0) + (slots.detail ? 1 : 0))
watch(
  () => props.rows,
  () => (open.value = undefined),
)

function evidenceUrl(uri: string | undefined): string | undefined {
  return uri && !/^data:/i.test(uri) ? toDisplayUrl(uri) : undefined
}
</script>

<template>
  <p v-if="rows.length === 0" class="muted">No rows match.</p>
  <div v-else class="table-wrap">
    <table class="feedback-table">
      <thead>
        <tr>
          <th>Reviewer</th>
          <th class="num">Value</th>
          <th>Tags</th>
          <th>Endpoint</th>
          <th v-if="hasStats" title="Authenticity weight (1 = full vote) and the rules that fired; hover a chip for its rule">Weight</th>
          <th>When</th>
          <th title="appendResponse entries: agent replies, refunds, spam flags">Replies</th>
          <th v-if="$slots.detail"><span class="sr-only">Detail</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="{ row, stats, index } in rows" :key="index">
          <tr :class="{ revoked: row.revoked, open: open === index }">
            <td class="nowrap">
              <RouterLink v-if="reviewerRoute" :to="reviewerRoute(row.client)" class="mono" :title="row.client">
                {{ shortAddress(row.client) }}
              </RouterLink>
              <a v-else :href="addressExplorerUrl(chain, row.client)" target="_blank" rel="noopener noreferrer" class="mono">
                {{ shortAddress(row.client) }}
              </a>
              <small v-if="row.index !== undefined" class="muted" title="Feedback index of this reviewer on this agent"> #{{ row.index }}</small>
            </td>
            <td class="num">
              <b>{{ formatScore(row.value) }}</b>
              <span v-if="row.revoked" class="chip">revoked</span>
            </td>
            <td class="tags">
              <span v-if="row.tag1" class="chip clip-chip" :title="row.tag1">{{ row.tag1 }}</span>
              <span v-if="row.tag2" class="chip clip-chip" :title="row.tag2">{{ row.tag2 }}</span>
            </td>
            <td class="endpoint">
              <span v-if="row.endpoint" class="ellipsis" :title="row.endpoint">{{ row.endpoint }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td v-if="hasStats" class="checks-cell">
              <template v-if="stats">
                <span class="weight" :class="{ low: stats.weight < 0.5 }" title="Authenticity weight">{{ formatNumber(stats.weight, 2) }}</span>
                <template v-for="flag in stats.flags" :key="flag">
                  <span v-if="flag !== 'revoked'" class="chip warn" :title="FLAG_INFO[flag].rule">{{ FLAG_INFO[flag].label }}</span>
                </template>
              </template>
            </td>
            <td class="nowrap">
              <template v-if="row.createdAt">
                <a
                  v-if="row.txHash"
                  :href="txExplorerUrl(chain, row.txHash)"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="`${formatDate(row.createdAt)} — open the transaction`"
                >
                  {{ formatTimeline(row.createdAt) }}
                </a>
                <span v-else :title="formatDate(row.createdAt)">{{ formatTimeline(row.createdAt) }}</span>
              </template>
              <span v-else class="muted" title="Older than the log scan window, or the source has no dates">—</span>
              <a v-if="evidenceUrl(row.feedbackURI)" :href="evidenceUrl(row.feedbackURI)" target="_blank" rel="noopener noreferrer" title="Feedback file (feedbackURI)">
                · file ↗
              </a>
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
            <td v-if="$slots.detail" class="num">
              <button class="row-toggle" :aria-expanded="open === index" @click="open = open === index ? undefined : index">
                {{ open === index ? 'Hide' : 'Inspect' }}
              </button>
            </td>
          </tr>
          <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" :colspan="columns" :open="open === index" />
          <tr v-if="$slots.detail && open === index" class="detail-row">
            <td :colspan="columns">
              <ul v-if="row.responses?.length" class="responses">
                <li v-for="(r, k) in row.responses" :key="k">
                  ↩ reply by
                  <a :href="addressExplorerUrl(chain, r.responder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(r.responder) }}</a>
                  <template v-if="r.createdAt"> · {{ formatDate(r.createdAt) }}</template>
                  <template v-if="r.uri">
                    ·
                    <a v-if="evidenceUrl(r.uri)" :href="evidenceUrl(r.uri)" target="_blank" rel="noopener noreferrer" class="ellipsis">{{ r.uri }}</a>
                    <span v-else class="muted">inline data</span>
                  </template>
                </li>
              </ul>
              <slot name="detail" :row="row" :index="index" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
