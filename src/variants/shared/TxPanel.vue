<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../../chains'
import type { FeedbackStats } from '../../data/feedbackStats'
import type { CheckStatus } from '../../data/txChecks'
import type { AgentDetail, Feedback } from '../../data/types'
import { shortAddress } from '../../format'
import { useTxView } from './use'

// Tx detail with neutral `txp-*` markup; each design styles it.
const props = defineProps<{ chain: ChainInfo; agent: AgentDetail; row: Feedback; index: number; stats: FeedbackStats }>()

const LABEL: Record<CheckStatus, string> = { pass: 'pass', warn: 'warn', fail: 'fail', missing: 'absent', unknown: 'unknown', info: 'info' }
const ORDER = ['pass', 'unknown', 'warn', 'missing', 'fail'] as const

const { facts, view, error, loading, reload } = useTxView(
  () => props.chain,
  () => props.agent,
  () => props.row,
  () => props.index,
  () => props.stats,
)
const segments = computed(() => (view.value ? ORDER.map((s) => ({ status: s, count: view.value!.band[s] })).filter((s) => s.count > 0) : []))
</script>

<template>
  <section class="txp" aria-label="Tx detail">
    <header class="txp-head">
      <b>What it would cost to fake this rating</b>
      <span v-if="facts?.tx" class="txp-meta">
        <a :href="txExplorerUrl(chain, facts.tx.hash)" target="_blank" rel="noopener noreferrer">{{ shortAddress(facts.tx.hash) }} ↗</a>
        · block {{ facts.tx.blockNumber }} · from
        <a :href="addressExplorerUrl(chain, facts.tx.from)" target="_blank" rel="noopener noreferrer">{{ shortAddress(facts.tx.from) }}</a>
      </span>
    </header>
    <p v-if="error" class="txp-state">Could not load: {{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !view" class="txp-state" aria-busy="true">Reading the transaction, the feedback file and the reviewer…</p>
    <template v-else>
      <div class="txp-band">
        <span class="txp-score">
          <b>{{ view.band.low }}<template v-if="view.band.high !== view.band.low">–{{ view.band.high }}</template></b> / {{ view.band.total }} checks hold
        </span>
        <span class="txp-bar" aria-hidden="true">
          <span v-for="s in segments" :key="s.status" :class="`txp-s-${s.status}`" :style="{ flex: s.count }" />
        </span>
        <span v-for="s in segments" :key="s.status" class="txp-count" :class="`txp-s-${s.status}`">{{ s.count }} {{ LABEL[s.status] }}</span>
      </div>
      <div class="txp-groups">
        <div v-for="g in view.groups" :key="g.id" class="txp-group">
          <h5>{{ g.title }}</h5>
          <ul>
            <li v-for="c in g.checks" :key="c.id" :title="c.rule">
              <span class="txp-status" :class="`txp-s-${c.status}`">{{ LABEL[c.status] }}</span>
              <span><b>{{ c.label }}</b> {{ c.detail }}</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
