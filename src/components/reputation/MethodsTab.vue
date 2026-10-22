<script setup lang="ts">
import { computed } from 'vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { computeScores } from '../../data/scores'
import { DOMINANT_SHARE, STRONG_REVIEWERS, THIN_REVIEWERS } from '../../data/trustReport'
import type { Feedback } from '../../data/types'
import { formatNumber, formatPercent, formatSigned } from '../../format'
import StatTiles, { type Tile } from '../ui/StatTiles.vue'

const props = defineProps<{ feedback: Feedback[]; self: string[] }>()

const s = computed(() => computeScores(props.feedback, { self: props.self }))

const alternatives = computed<Tile[]>(() => [
  { label: 'Weighted', value: formatNumber(s.value.weighted), hint: `${formatNumber(s.value.effectiveCount)} full votes`, title: 'Σ w·x / Σ w — the trusted score', tone: 'main' },
  { label: 'Median', value: formatNumber(s.value.median), hint: `trimmed mean ${formatNumber(s.value.trimmed)}`, title: 'Middle valid value; one extreme review cannot move it' },
  { label: 'Bayesian', value: formatNumber(s.value.bayes), hint: 'prior 0, weight 5', title: '(W·weighted + 5·0)/(W+5): few votes pull toward 0' },
  { label: 'Time-decayed', value: formatNumber(s.value.timeWeighted), hint: '90-day half-life', title: 'Weights fade by exp(−λ·age): old reviews count less' },
  { label: '95% bound', value: formatNumber(s.value.lcb), hint: 'rank by this', title: 'weighted − 1.96·sd/√W, floored at the lowest value; needs 2 full votes' },
])

const shape = computed(() => [
  { label: 'Gap raw − trusted', value: formatSigned(s.value.gap), rule: 'Large and positive = the rules removed inflated reviews.' },
  { label: 'Trust mass', value: formatPercent(s.value.trustMass), rule: 'Full votes / reviews. Near 100% clean, near 0 farmed.' },
  { label: 'Independent voices', value: formatNumber(s.value.clientsEff), rule: 'exp(entropy of weight per reviewer). 1 = one reviewer holds it all.' },
  { label: 'Consensus', value: formatPercent(s.value.consensus), rule: '1 − variance / max variance for the observed range.' },
  { label: 'Polarization', value: formatPercent(s.value.polarization), rule: '0 = united, 100% = two opposite camps.' },
  { label: 'Positive', value: formatPercent(s.value.posRate), rule: 'Share of valid values above 0.' },
  { label: 'Momentum', value: formatSigned(s.value.momentum), rule: 'Time-decayed mean of the last 30 days minus the 30–120 days before.' },
])

const flags = Object.entries(FLAG_INFO).map(([id, info]) => ({ id, ...info }))
const labels = Object.entries(LABEL_INFO).map(([id, info]) => ({ id, ...info }))
</script>

<template>
  <section class="panel">
    <h3>Other ways to score the same reviews</h3>
    <StatTiles :tiles="alternatives" />
    <dl class="metric-list">
      <template v-for="m in shape" :key="m.label">
        <dt>{{ m.label }}</dt>
        <dd><b>{{ m.value }}</b> <small class="muted">{{ m.rule }}</small></dd>
      </template>
    </dl>
  </section>

  <section v-if="s.perTag.length > 1" class="panel">
    <h3>By tag <small class="muted">different tags can mean different scales — compare within a tag</small></h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>tag1</th><th class="num">Reviews</th><th class="num">Weighted avg</th></tr></thead>
        <tbody>
          <tr v-for="t in s.perTag" :key="t.tag">
            <td><span class="chip clip-chip" :title="t.tag">{{ t.tag }}</span></td>
            <td class="num">{{ t.count }}</td>
            <td class="num">{{ formatNumber(t.average) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <h3>Rules on a review</h3>
    <dl class="metric-list">
      <template v-for="f in flags" :key="f.id">
        <dt><span class="chip warn">{{ f.label }}</span></dt>
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
    <h3>Evidence levels</h3>
    <dl class="metric-list">
      <dt>none</dt>
      <dd>No review carries weight.</dd>
      <dt>thin</dt>
      <dd>Under {{ THIN_REVIEWERS }} independent voices or under {{ THIN_REVIEWERS }} full votes.</dd>
      <dt>moderate</dt>
      <dd>Anything between thin and strong.</dd>
      <dt>strong</dt>
      <dd>{{ STRONG_REVIEWERS }}+ independent voices, {{ STRONG_REVIEWERS }}+ full votes, and no reviewer holding {{ DOMINANT_SHARE * 100 }}% of the weight.</dd>
    </dl>
    <p class="muted note">
      Everything here is computed in your browser from on-chain rows. No IP, device or text signals exist on-chain; a reviewer
      with many fresh wallets that each rate once at varied values passes every rule. Shared funders on the Reviewers tab are
      the check for that.
    </p>
  </section>
</template>
