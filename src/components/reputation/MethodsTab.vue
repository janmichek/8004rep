<script setup lang="ts">
import { computed } from 'vue'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import type { ReputationReport } from '../../data/reputation/report'
import { DOMINANT_SHARE, STRONG_NEFF, STRONG_WEIGHT, THIN_WALLETS, THIN_WEIGHT } from '../../data/reputation/score'
import { LABEL_INFO } from '../../data/reviewerProfile'
import type { Feedback } from '../../data/types'
import { formatNumber, formatPercent, formatSigned } from '../../format'
import FlagChip from '../ui/FlagChip.vue'
import StatTiles, { type Tile } from '../ui/StatTiles.vue'

const props = defineProps<{ rep: ReputationReport; feedback: Feedback[] }>()

function downloadInputs(): void {
  const r = props.rep
  const inputs = {
    formulaVersion: r.formulaVersion,
    params: r.params,
    counts: r.counts,
    funnel: r.funnel,
    concentration: r.concentration,
    rows: props.feedback.map((f, i) => ({
      index: i,
      client: f.client,
      value: f.value,
      tag1: f.tag1 ?? null,
      tag2: f.tag2 ?? null,
      createdAt: f.createdAt ?? null,
      revoked: f.revoked,
      kind: r.layer.classified[i]?.kind ?? null,
      scale: r.layer.classified[i]?.scale ?? null,
      rating: r.layer.classified[i]?.r ?? null,
    })),
    units: r.layer.units.map((u) => ({ client: u.client, tag: u.tag, window: u.bucket, rating: u.r, rows: u.rows, weight: u.time })),
    wallets: r.layer.wallets.map((w) => ({ client: w.client, rating: w.r, weight: w.weight, units: w.units.length, rows: w.rows })),
  }
  const blob = new Blob([JSON.stringify(inputs, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `reputation-inputs-${r.formulaVersion}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const alternatives = computed<Tile[]>(() => [
  {
    label: 'Robust score',
    value: props.rep.unrated ? 'Unrated' : formatNumber(props.rep.score),
    hint: props.rep.interval ? `80% interval ${formatNumber(props.rep.interval[0])}–${formatNumber(props.rep.interval[1])}` : 'no rating units',
    title: '(α0·μ0 + Σ W_c·r̄_c) / (α0 + Σ W_c) — one independent wallet is one vote',
    tone: 'main',
    word: props.rep.unrated,
    meter: props.rep.unrated ? undefined : { kind: 'gauge', value: props.rep.score, band: props.rep.interval },
  },
  {
    label: 'Effective voices',
    value: formatNumber(props.rep.funnel.walletsAfterCap ? props.rep.concentration.neff : 0),
    hint: `${props.rep.funnel.wallets} wallets after cap`,
    title: '1 / HHI over wallet weights: how many equally-weighted voices the result is worth',
  },
  {
    label: 'Inflation gap',
    value: formatSigned(props.rep.inflation),
    hint: 'raw rating mean − robust',
    title: 'Large and positive = the rules removed reviews the raw mean counts in full.',
  },
  {
    label: 'Cost to fake',
    value: props.rep.cost === null ? '—' : String(props.rep.cost),
    hint: 'fresh unlinked wallets',
    title: `Wallets at the target of ${Math.round(props.rep.params.fakeTarget * 100)}/100, assuming they cannot be linked. Each also costs its feedback fee and a funding path.`,
  },
])

const shape = computed(() => [
  { label: 'Top wallet', value: formatPercent(props.rep.concentration.top1), rule: 'Largest share of the weight after the per-wallet cap.' },
  { label: 'Top three', value: formatPercent(props.rep.concentration.top3), rule: 'Share of the weight held by the three largest wallets.' },
  { label: 'Effective voices', value: formatNumber(props.rep.concentration.neff), rule: '1 / HHI over wallet weights; 1 = one wallet holds it all.' },
  { label: 'Largest influence', value: formatPercent(props.rep.concentration.maxInfluence), rule: 'Largest wallet share of (prior + weights); the prior alone is 3/6 = 50% for one wallet.' },
  { label: 'Rows scored', value: formatPercent(props.rep.funnel.feedback ? props.rep.funnel.ratedRows / props.rep.funnel.feedback : null), rule: 'Rating rows inside their scale, out of every row read.' },
])

const funnel = computed(() => [
  { label: 'Rows read', n: props.rep.funnel.feedback },
  { label: 'Rating rows', n: props.rep.funnel.ratedRows },
  { label: 'Rating units', n: props.rep.funnel.units, hint: 'one per wallet, tag and 30-day window' },
  { label: 'Wallets', n: props.rep.funnel.wallets },
  { label: 'Wallets carrying weight', n: props.rep.funnel.walletsAfterCap },
])

const flags = (Object.entries(FLAG_INFO) as [RowFlag, { label: string; rule: string }][]).map(([id, info]) => ({ id, ...info }))
const labels = Object.entries(LABEL_INFO).map(([id, info]) => ({ id, ...info }))
</script>

<template>
  <section class="panel">
    <h3>How the score is built</h3>
    <StatTiles :tiles="alternatives" />
    <dl class="metric-list">
      <template v-for="m in shape" :key="m.label">
        <dt>{{ m.label }}</dt>
        <dd><b>{{ m.value }}</b> <small class="muted">{{ m.rule }}</small></dd>
      </template>
    </dl>
  </section>

  <section class="panel">
    <h3>From rows to voices</h3>
    <ul class="meters">
      <li v-for="f in funnel" :key="f.label">
        <span class="bar-label">{{ f.label }}</span>
        <span class="bar-track" aria-hidden="true"><span :style="{ width: `${props.rep.funnel.feedback ? (f.n / props.rep.funnel.feedback) * 100 : 0}%` }" /></span>
        <span class="bar-value">{{ f.n }}</span>
        <span v-if="f.hint" class="bar-note muted">{{ f.hint }}</span>
      </li>
    </ul>
  </section>

  <section class="panel">
    <h3>What counts <small class="muted">only ratings enter the score</small></h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Kind</th><th class="num">Rows</th><th>Treatment</th></tr>
        </thead>
        <tbody>
          <tr v-for="k in props.rep.byKind" :key="k.kind">
            <td>{{ k.label }}</td>
            <td class="num">{{ k.rows }}</td>
            <td class="muted">{{ k.kind === 'rating' ? 'normalised to 0–1 on the inferred scale and scored' : 'shown, never averaged into the score' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <h3>Parameters</h3>
    <dl class="metric-list">
      <dt>Unit window</dt>
      <dd>{{ props.rep.params.unitWindowDays }} days</dd>
      <dt>Half-life</dt>
      <dd>{{ props.rep.params.halfLifeDays }} days</dd>
      <dt>Prior</dt>
      <dd>{{ props.rep.params.alpha0 }} wallets at {{ formatNumber(props.rep.params.mu0 * 100) }}/100</dd>
      <dt>Formula</dt>
      <dd><code>{{ props.rep.formulaVersion }}</code></dd>
    </dl>
  </section>

  <section class="panel">
    <h3>Rules on each feedback</h3>
    <dl class="metric-list">
      <template v-for="f in flags" :key="f.id">
        <dt><FlagChip :flag="f.id" /></dt>
        <dd>{{ f.rule }}</dd>
      </template>
    </dl>
  </section>

  <section class="panel">
    <h3>Rules on a reviewer <small class="muted">from its feedback across agents</small></h3>
    <dl class="metric-list">
      <template v-for="l in labels" :key="l.id">
        <dt><span class="chip" :class="l.tone === 'warn' ? 'warn' : ''">{{ l.label }}</span></dt>
        <dd>{{ l.rule }}</dd>
      </template>
    </dl>
  </section>

  <section class="panel">
    <h3>Responsiveness <small class="muted">how often a low rating gets an answer</small></h3>
    <dl class="metric-list">
      <dt>Low ratings</dt>
      <dd><b>{{ props.rep.responsiveness.lowRatings }}</b> at or below half of their scale</dd>
      <dt>Answered</dt>
      <dd><b>{{ formatPercent(props.rep.responsiveness.share) }}</b> of them carry a response</dd>
      <dt>Median lag</dt>
      <dd>{{ props.rep.responsiveness.medianLagDays === null ? '—' : `${formatNumber(props.rep.responsiveness.medianLagDays)} days` }}</dd>
      <dt>Who replies</dt>
      <dd>{{ props.rep.responsiveness.ownerReplies }} from the owner or agent wallet, {{ props.rep.responsiveness.thirdPartyReplies }} from anyone else</dd>
    </dl>
  </section>

  <section class="panel">
    <h3>Confidence</h3>
    <dl class="metric-list">
      <dt>low</dt>
      <dd>Under {{ THIN_WEIGHT }} full votes or under {{ THIN_WALLETS }} wallets.</dd>
      <dt>moderate</dt>
      <dd>Anything between low and high.</dd>
      <dt>high</dt>
      <dd>{{ STRONG_WEIGHT }}+ full votes, {{ STRONG_NEFF }}+ effective voices, and no wallet holding {{ DOMINANT_SHARE * 100 }}% of the weight.</dd>
      <dt>Unrated</dt>
      <dd>No rating rows at all. Telemetry and outcomes are shown but never scored.</dd>
    </dl>
    <p class="muted note">
      Everything here is computed in your browser from on-chain rows. No IP, device or text signals exist on-chain; a reviewer
      with many fresh wallets that each rate once at varied values passes every rule. Shared funders on the Reviewers tab are
      the check for that.
    </p>
    <p class="toolbar">
      <button type="button" class="btn" @click="downloadInputs">Download inputs (JSON)</button>
      <small class="muted">Every row, its kind, scale and rating, the units and the wallet weights — enough to recompute the score.</small>
    </p>
  </section>
</template>
