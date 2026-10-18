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
  const engagement = score.dimensions.find((d) => d.id === 'engagement')
  if (engagement && score.feedback) {
    const ramp =
      score.feedback.weight !== undefined && score.feedback.weight < 1
        ? `, counted at ${Math.round(score.feedback.weight * 100)}% because there are few rows`
        : ''
    notes.push(
      `Feedback reaches 8004scan only through Engagement (${Math.round(engagement.weight * 100)}% of the total), as the plain average ${formatNumber(score.feedback.average)} of ${score.feedback.count} rows${ramp}. Stars and page views share that dimension.`,
    )
    notes.push('No reviewer is discounted there: self-reviews, duplicates and bursts count in full, and more rows push the score up.')
    if (props.raw !== null && Math.abs(score.feedback.average - props.raw) >= 5) {
      const valid = props.feedback.filter((f) => !f.revoked)
      const starred = valid.filter((f) => f.tag1?.toLowerCase() === 'starred').length
      notes.push(
        `Its feedback average ${formatNumber(score.feedback.average)} is far from the on-chain mean ${formatNumber(props.raw)}.` +
          (starred < valid.length
            ? ` Only ${starred} of ${valid.length} rows here are tagged “starred”; 8004scan appears to score only rows on a tag it knows and to read the rest as no score.`
            : ''),
      )
    }
  }
  const others = score.dimensions.filter((d) => d.id !== 'engagement')
  const rest = others.reduce((a, d) => a + d.weight, 0)
  if (rest > 0) {
    notes.push(
      `${others.map((d) => d.label).join(', ')} (${Math.round(rest * 100)}% together) rate the listing itself — services, wallet, metadata, activity — not what reviewers said.`,
    )
  }
  if (score.band) notes.push(`Final scores are squeezed into ${formatNumber(score.band.floor)}–${formatNumber(score.band.ceiling)}, so many agents tie.`)
  if (score.feedback && score.feedback.count !== props.feedback.length) {
    notes.push(`8004scan counts ${score.feedback.count} rows; this page read ${props.feedback.length} (indexer lag or scan window).`)
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
        <div class="tile-label">Trusted here</div>
        <div class="compare-value accent">{{ formatNumber(trusted) }}</div>
        <small class="muted">after the rules</small>
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
