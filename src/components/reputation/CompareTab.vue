<script setup lang="ts">
import { computed } from 'vue'
import { agentScanUrl, type ChainInfo } from '../../chains'
import type { ScanScore } from '../../data/scan'
import type { Feedback } from '../../data/types'
import { formatNumber } from '../../format'
import Skeleton from '../ui/Skeleton.vue'

const props = defineProps<{
  chain: ChainInfo
  tokenId: bigint
  feedback: Feedback[]
  raw: number | null
  trusted: number | null
  scan?: ScanScore | null
  loading: boolean
  error?: string
}>()

const notes = computed(() => {
  const score = props.scan
  if (!score) return []
  const notes: string[] = []
  const p = score.policy
  if (p && score.band) {
    notes.push(
      `The headline is ${formatNumber(score.band.floor)} + (${formatNumber(score.band.ceiling)} − ${formatNumber(score.band.floor)}) × merit / 100, and merit = ${formatNumber(p.proofWeight * 100, 0)}% proof + ${formatNumber(p.supportWeight * 100, 0)}% support. Here that is ${formatNumber(p.proofScore)} and ${formatNumber(p.supportScore)} → ${formatNumber(p.merit)} merit → ${formatNumber(score.total)}.`,
    )
    notes.push(
      'The dimensions listed below are its legacy breakdown (engagement, service, publisher, compliance, momentum). They no longer drive the headline; proof and support do.',
    )
  }
  if (score.feedback) {
    notes.push(
      `Feedback enters through the support score, as the plain average ${formatNumber(score.feedback.average)} of ${score.feedback.count} feedback${score.feedback.weight !== undefined && score.feedback.weight < 1 ? `, counted at ${Math.round(score.feedback.weight * 100)}% for volume` : ''}. No reviewer is discounted there: self-feedback, duplicates and bursts count in full, and more feedback pushes support up.`,
    )
    if (props.raw !== null && Math.abs(score.feedback.average - props.raw) >= 5) {
      notes.push(`Its feedback average ${formatNumber(score.feedback.average)} differs from the on-chain mean ${formatNumber(props.raw)} here by ${formatNumber(Math.abs(score.feedback.average - props.raw))}.`)
    }
  }
  if (p?.proofScore !== undefined) {
    notes.push(
      `Proof is capped at ${formatNumber(p.proofScore)} here and does not fall when one wallet writes thousands of rows, which is why a single-wallet record can still read as ${p.evidenceTier ?? 'strong'} evidence.`,
    )
  }
  if (score.band) notes.push(`Final scores are squeezed into ${formatNumber(score.band.floor)}–${formatNumber(score.band.ceiling)}, so many agents tie.`)
  if (score.feedback && score.feedback.count !== props.feedback.length) {
    notes.push(`8004scan counts ${score.feedback.count} feedback; this page read ${props.feedback.length} (indexer lag or scan window).`)
  }
  return notes
})
</script>

<template>
  <div v-if="loading" class="compare-head" aria-busy="true" aria-live="polite">
    <span class="sr-only">Asking 8004scan</span>
    <div v-for="i in 4" :key="i" class="skeleton-stack">
      <Skeleton width="8em" height="0.7em" />
      <Skeleton width="3.2em" height="1.5em" />
      <Skeleton width="9em" height="0.7em" />
    </div>
  </div>
  <p v-else-if="error" class="notice">8004scan could not be reached: {{ error }}</p>
  <p v-else-if="!scan" class="muted">
    8004scan has not scored this agent.
    <a :href="agentScanUrl(chain, tokenId)" target="_blank" rel="noopener noreferrer">Open it there ↗</a>
  </p>
  <template v-else>
    <div class="compare-head">
      <div>
        <div class="tile-label">8004scan overall</div>
        <div class="compare-value">{{ formatNumber(scan.total) }}</div>
        <small class="muted">rates the whole listing</small>
      </div>
      <div>
        <div class="tile-label">Its feedback average</div>
        <div class="compare-value">{{ formatNumber(scan.feedback?.average) }}</div>
        <small class="muted">plain mean, {{ scan.feedback?.count ?? '?' }} rows</small>
      </div>
      <div>
        <div class="tile-label">Raw on-chain here</div>
        <div class="compare-value">{{ formatNumber(raw) }}</div>
        <small class="muted">{{ feedback.length }} rows read</small>
      </div>
      <div>
        <div class="tile-label">Robust here</div>
        <div class="compare-value accent">{{ formatNumber(trusted) }}</div>
        <small class="muted">one vote per wallet, ratings only</small>
      </div>
    </div>

    <section class="panel">
      <h3>Its dimensions <small class="muted">score · weight in the total</small></h3>
      <ul class="bars">
        <li v-for="dim in scan.dimensions" :key="dim.id">
          <span class="bar-label">{{ dim.label }} <small class="muted">{{ Math.round(dim.weight * 100) }}%</small></span>
          <span class="bar-track" aria-hidden="true"><span :style="{ width: `${Math.min(100, dim.score)}%` }" /></span>
          <span class="bar-value">{{ formatNumber(dim.score) }}</span>
        </li>
      </ul>
    </section>

    <section class="panel">
      <h3>Why the numbers differ</h3>
      <ul class="reasons">
        <li v-for="note in notes" :key="note">{{ note }}</li>
      </ul>
      <p class="muted note">
        {{ scan.algorithm ?? 'Scoring' }}<template v-if="scan.scoredAt">, scored {{ scan.scoredAt.slice(0, 10) }}</template>.
        <a :href="agentScanUrl(chain, tokenId)" target="_blank" rel="noopener noreferrer">Open on 8004scan ↗</a>
      </p>
    </section>
  </template>
</template>
