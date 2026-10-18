<script setup lang="ts">
import { computed } from 'vue'
import { dailyColumns, valueHistogram } from '../../data/chartData'
import type { FeedbackStats } from '../../data/feedbackStats'
import type { LadderId, TrustReport } from '../../data/trustReport'
import type { Feedback } from '../../data/types'
import { formatNumber, formatPercent, formatSigned } from '../../format'
import ColumnChart from '../ui/ColumnChart.vue'
import Hint from '../ui/Hint.vue'
import { COUNT_SERIES, WEIGHT_LABELS, WEIGHT_SERIES, weightClass } from '../ui/palette'

const props = defineProps<{ feedback: Feedback[]; stats: FeedbackStats; report: TrustReport; ecosystemAverage?: number }>()

const activity = computed(() =>
  dailyColumns(
    props.feedback.map((row, i) => ({ row, weight: props.stats.rows[i].weight })),
    (d) => d.row.createdAt,
    (d) => weightClass(d.row.revoked, d.weight),
    WEIGHT_SERIES.map((s) => s.key),
    WEIGHT_LABELS,
  ),
)
const undated = computed(() => props.feedback.filter((f) => f.createdAt === undefined).length)
const distribution = computed(() => valueHistogram(props.feedback.filter((f) => !f.revoked).map((f) => f.value)))

/** One scale for every waterfall bar: 0–100, stretched when values leave it. */
const scale = computed(() => {
  const values = props.feedback.map((f) => f.value)
  return { lo: Math.min(0, ...values), hi: Math.max(100, ...values) }
})
function barWidth(value: number | null): string {
  if (value === null) return '0%'
  const { lo, hi } = scale.value
  return `${Math.max(0, Math.min(100, ((value - lo) / (hi - lo)) * 100))}%`
}

const LADDER_COLOR: Record<LadderId, string> = { bare: '#5b6472', context: '#3987e5', file: '#0ca30c' }
const ladderTotal = computed(() => props.report.ladder.reduce((a, r) => a + r.rows, 0))

const coverage = computed(() => {
  const c = props.stats.coverage
  return [
    { label: 'Dated', n: c.dated, rule: 'Burst, surge and trend checks need a date.' },
    { label: 'Transaction known', n: c.withTx, rule: 'Lets the Tx detail check who sent and paid for the row.' },
    { label: 'Feedback file', n: c.withUri, rule: 'Comment, task or payment proof behind the row.' },
    { label: 'Endpoint named', n: c.withEndpoint, rule: 'Says which service was rated.' },
  ].map((m) => ({ ...m, share: c.total ? m.n / c.total : 0 }))
})
</script>

<template>
  <div class="overview">
    <section class="panel">
      <h3>What stands out</h3>
      <ul v-if="stats.signals.length" class="signals">
        <li v-for="signal in stats.signals" :key="signal.code" :class="`level-${signal.level}`">
          <span class="signal-level">{{ signal.level }}</span> <span>{{ signal.text }}</span>
        </li>
      </ul>
      <p v-else class="muted">No warning signs in these rows.</p>
      <ul class="reasons">
        <li v-for="reason in report.strength.reasons" :key="reason">{{ reason }}</li>
      </ul>
    </section>

    <div class="chart-grid">
      <ColumnChart title="Feedback over time, by weight" :columns="activity" :series="WEIGHT_SERIES" />
      <ColumnChart
        title="Values given (non-revoked)"
        :columns="distribution"
        :series="COUNT_SERIES"
        :marker="ecosystemAverage !== undefined ? { at: ecosystemAverage, label: `ecosystem avg ${formatNumber(ecosystemAverage)}` } : undefined"
      />
    </div>
    <p v-if="undated" class="muted note">{{ undated }} row{{ undated === 1 ? ' has' : 's have' }} no date and {{ undated === 1 ? 'is' : 'are' }} left out of the time chart.</p>

    <section class="panel">
      <h3>How the score is built <small class="muted">each step applies one rule to the step before</small></h3>
      <ol class="bars waterfall">
        <li v-for="step in report.waterfall" :key="step.id" :class="{ idle: step.id !== 'all' && step.rows === 0 }">
          <span class="bar-label">{{ step.label }}</span>
          <span class="bar-track" aria-hidden="true"><span :style="{ width: barWidth(step.average) }" /></span>
          <span class="bar-value">{{ formatNumber(step.average) }}</span>
          <span class="bar-delta" :class="{ down: (step.delta ?? 0) < -0.05, up: (step.delta ?? 0) > 0.05 }">
            {{ step.id === 'all' ? '' : formatSigned(step.delta) }}
          </span>
          <span class="bar-note muted">
            {{ step.id === 'all' ? `${step.rows} rows` : step.rows ? `${step.rows} row${step.rows === 1 ? '' : 's'} touched` : 'nothing found' }}
          </span>
          <small class="bar-rule muted">{{ step.rule }}</small>
        </li>
      </ol>
    </section>

    <section class="panel">
      <h3>Evidence behind the rows</h3>
      <div v-if="ladderTotal" class="stack-bar" role="img" :aria-label="report.ladder.map((r) => `${r.label}: ${r.rows}`).join(', ')">
        <Hint
          v-for="rung in report.ladder.filter((r) => r.rows > 0)"
          :key="rung.id"
          :text="`${rung.label}: ${rung.rows} — ${rung.rule}`"
        >
          <span :style="{ flexGrow: rung.rows, background: LADDER_COLOR[rung.id] }" />
        </Hint>
      </div>
      <ul class="legend-list">
        <li v-for="rung in report.ladder" :key="rung.id">
          <span class="swatch" :style="{ background: LADDER_COLOR[rung.id] }" />
          {{ rung.label }} <b>{{ rung.rows }}</b> <small class="muted">{{ rung.rule }}</small>
        </li>
      </ul>
      <ul class="meters">
        <Hint v-for="m in coverage" :key="m.label" :text="m.rule">
        <li>
          <span class="bar-label">{{ m.label }}</span>
          <span class="bar-track" aria-hidden="true"><span :style="{ width: `${m.share * 100}%` }" /></span>
          <span class="bar-value">{{ formatPercent(m.share) }}</span>
          <span class="bar-note muted">{{ m.n }} of {{ stats.coverage.total }}</span>
        </li>
        </Hint>
      </ul>
    </section>
  </div>
</template>
