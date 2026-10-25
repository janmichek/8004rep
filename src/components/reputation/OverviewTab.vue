<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { dailyColumns, valueHistogram } from '../../data/chartData'
import type { FeedbackStats } from '../../data/feedbackStats'
import { KIND_INFO } from '../../data/reputation/kinds'
import type { ReputationReport } from '../../data/reputation/report'
import type { LadderId, TrustReport } from '../../data/trustReport'
import type { Feedback } from '../../data/types'
import { formatNumber, formatPercent, formatSigned } from '../../format'
import ColumnChart from '../ui/ColumnChart.vue'
import Hint from '../ui/Hint.vue'
import { COUNT_SERIES, WEIGHT_LABELS, WEIGHT_SERIES, weightClass } from '../ui/palette'

const props = defineProps<{ feedback: Feedback[]; stats: FeedbackStats; report: TrustReport; rep: ReputationReport }>()

/** Waterfall step → About page metric anchor. */
const STEP_ABOUT: Record<string, string> = {
  all: 'raw-onchain',
  revoked: 'revoked',
  ratings: 'rating-only',
  units: 'rating-unit',
  cap: 'wallet-vote',
  prior: 'prior',
}

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

/** Only rating rows, read on their own scale: a 5-star feedback is not 5/100. */
const distribution = computed(() =>
  valueHistogram(
    props.rep.layer.classified.flatMap((c, i) => (!props.feedback[i].revoked && c.kind === 'rating' && c.r !== null ? [c.r * 100] : [])),
    'rating',
  ),
)

/** One scale for every waterfall bar; normalised steps are always 0–100. */
function barWidth(value: number | null): string {
  if (value === null) return '0%'
  return `${Math.max(0, Math.min(100, value))}%`
}

const LADDER_COLOR: Record<LadderId, string> = { bare: '#5b6472', context: '#3987e5', file: '#0ca30c' }
const ladderTotal = computed(() => props.report.ladder.reduce((a, r) => a + r.rows, 0))

const kinds = computed(() => props.rep.byKind.filter((k) => k.rows > 0))

const coverage = computed(() => {
  const c = props.stats.coverage
  return [
    { label: 'Dated', n: c.dated, rule: 'Burst, surge and trend checks need a date.', about: 'coverage' },
    { label: 'Transaction known', n: c.withTx, rule: 'Lets the Tx detail check who sent and paid for the feedback.', about: 'coverage' },
    { label: 'Feedback file', n: c.withUri, rule: 'Comment, task or payment proof behind the feedback.', about: 'evidence-ladder' },
    { label: 'Endpoint named', n: c.withEndpoint, rule: 'Says which service was rated.', about: 'coverage' },
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
      <p v-else class="muted">No warning signs in this feedback.</p>
      <ul v-if="rep.findings.length" class="signals">
        <li v-for="finding in rep.findings" :key="finding.code" :class="`level-${finding.level}`">
          <span class="signal-level">{{ finding.level }}</span> <span>{{ finding.text }}</span>
        </li>
      </ul>
      <ul class="reasons">
        <li v-for="reason in report.strength.reasons" :key="reason">{{ reason }}</li>
      </ul>
    </section>

    <div class="chart-grid">
      <ColumnChart title="Feedback over time, by weight" :columns="activity" :series="WEIGHT_SERIES" />
      <ColumnChart
        title="Rating values, normalised"
        :columns="distribution"
        :series="COUNT_SERIES"
      />
    </div>
    <p v-if="undated" class="muted note">{{ undated }} row{{ undated === 1 ? ' has' : 's have' }} no date and {{ undated === 1 ? 'is' : 'are' }} left out of the time chart.</p>

    <section class="panel">
      <h3>
        How the score is built
        <small class="muted">
          <RouterLink :to="{ name: 'about', hash: '#score' }">how it works</RouterLink>
        </small>
      </h3>
      <ol class="bars waterfall">
        <li v-for="step in rep.waterfall" :key="step.id" :class="{ idle: step.id !== 'all' && step.rows === 0 }">
          <Hint :text="step.rule" :about="STEP_ABOUT[step.id]">
            <span class="bar-label tip">{{ step.label }}</span>
          </Hint>
          <span class="bar-track" aria-hidden="true"><span :style="{ width: barWidth(step.average) }" /></span>
          <span class="bar-value">{{ formatNumber(step.average) }}</span>
          <span class="bar-delta" :class="{ down: (step.delta ?? 0) < -0.05, up: (step.delta ?? 0) > 0.05 }">
            {{ step.id === 'all' ? '' : formatSigned(step.delta) }}
          </span>
          <span class="bar-note muted">{{ step.rows }} row{{ step.rows === 1 ? '' : 's' }}</span>
        </li>
      </ol>
    </section>

    <section class="panel">
      <h3>
        What the values mean
        <small class="muted">
          <RouterLink :to="{ name: 'about', hash: '#rating-only' }">only ratings are scored</RouterLink>
        </small>
      </h3>
      <dl class="metric-list">
        <template v-for="k in kinds" :key="k.kind">
          <dt>
            <Hint :text="KIND_INFO[k.kind].rule" :about="k.kind === 'telemetry' ? 'telemetry' : 'rating-only'">
              <span class="tip">{{ k.label }}</span>
            </Hint>
          </dt>
          <dd><b>{{ k.rows }}</b></dd>
        </template>
      </dl>
      <p v-if="rep.counts.outOfScale" class="muted note">
        {{ rep.counts.outOfScale }} rating row{{ rep.counts.outOfScale === 1 ? '' : 's' }} fall outside the scale inferred for the tag and are listed but not scored.
        <RouterLink :to="{ name: 'about', hash: '#off-scale' }">About</RouterLink>
      </p>
    </section>

    <section v-if="rep.telemetry.length" class="panel">
      <h3>Telemetry <small class="muted">answers “is it up”, not “is it good”</small></h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Tag</th><th class="num">Rows</th><th class="num">Wallets</th><th class="num">Latest</th><th class="num">Median</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in rep.telemetry" :key="t.tag">
              <td><span class="chip clip-chip" :title="t.label">{{ t.label }}</span></td>
              <td class="num">{{ t.rows }}</td>
              <td class="num">{{ t.clients }}</td>
              <td class="num">{{ formatNumber(t.latest) }}</td>
              <td class="num">{{ formatNumber(t.median) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h3>
        Evidence behind the feedback
        <small class="muted">
          <RouterLink :to="{ name: 'about', hash: '#evidence-ladder' }">About</RouterLink>
        </small>
      </h3>
      <div v-if="ladderTotal" class="stack-bar" role="img" :aria-label="report.ladder.map((r) => `${r.label}: ${r.rows}`).join(', ')">
        <Hint
          v-for="rung in report.ladder.filter((r) => r.rows > 0)"
          :key="rung.id"
          :text="`${rung.label}: ${rung.rows} — ${rung.rule}`"
          about="evidence-ladder"
        >
          <span :style="{ flexGrow: rung.rows, background: LADDER_COLOR[rung.id] }" />
        </Hint>
      </div>
      <ul class="legend-list">
        <li v-for="rung in report.ladder" :key="rung.id">
          <span class="swatch" :style="{ background: LADDER_COLOR[rung.id] }" />
          <Hint :text="rung.rule" about="evidence-ladder">
            <span class="tip">{{ rung.label }}</span>
          </Hint>
          <b>{{ rung.rows }}</b>
        </li>
      </ul>
      <ul class="meters">
        <li v-for="m in coverage" :key="m.label">
          <Hint :text="m.rule" :about="m.about">
            <span class="bar-label tip">{{ m.label }}</span>
          </Hint>
          <span class="bar-track" aria-hidden="true"><span :style="{ width: `${m.share * 100}%` }" /></span>
          <span class="bar-value">{{ formatPercent(m.share) }}</span>
          <span class="bar-note muted">{{ m.n }} of {{ stats.coverage.total }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
