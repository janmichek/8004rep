<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import type { StrengthTier } from '../../data/trustReport'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { byDay, letterGrade, sparkPath100, velocity } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { conditionOf, confidenceOf, windOf } from './weather'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()

const condition = computed(() => conditionOf(report.value?.trusted, stats.value?.level))
const confidence = computed(() => confidenceOf(stats.value?.coverage.total, report.value?.strength.tier))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const tierWords: Record<StrengthTier, string> = { none: 'no evidence', thin: 'thin', moderate: 'moderate', strong: 'strong' }
const wind = computed(() => windOf(velocity(agent.value?.feedback.map((f) => f.createdAt) ?? [])))
const pressure = computed(() => (report.value?.raw !== null && report.value?.raw !== undefined && report.value?.trusted !== null && report.value?.trusted !== undefined ? report.value.trusted - report.value.raw : null))

// Daily mean values, oldest first, for the outlook line.
const outlook = computed(() => {
  const rows = [...(agent.value?.feedback ?? [])].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  return byDay(rows)
    .filter((d) => d.day !== null)
    .map((d) => {
      const live = d.rows.filter((r) => !r.revoked)
      return { day: d.day!, value: live.length ? live.reduce((n, r) => n + r.value, 0) / live.length : 0, n: live.length }
    })
    .filter((d) => d.n > 0)
})
const path = computed(() => sparkPath100(outlook.value.map((d) => d.value), 600, 110))
</script>

<template>
  <p v-if="error" class="f-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="f-empty">Reading the instruments…</p>
  <template v-else-if="agent === null">
    <p class="f-kicker">Station unknown</p>
    <h1 class="f-h1">Station {{ id }} does not report here.</h1>
  </template>
  <template v-else>
    <p class="f-kicker"><RouterLink :to="to.agents()">Local forecast</RouterLink> / station {{ agent.tokenId }}</p>
    <h1 class="f-h1">{{ file === undefined ? '…' : name }}</h1>
    <p class="f-lede">{{ file?.description ?? 'No description filed with this station.' }}</p>

    <div class="f-now">
      <div>
        <div class="f-temp">{{ formatNumber(report?.trusted) }}<sup>°</sup></div>
        <div class="f-condition">{{ condition.label }} · grade {{ grade }}</div>
      </div>
      <div>
        <p class="f-prose" style="margin: 0 0 6px">{{ report?.headline ?? 'No observations on record.' }}</p>
        <p class="f-prose" style="margin: 0; font-size: 13px">
          {{ confidence.detail }}. Feels like {{ formatNumber(report?.raw) }} before discounts; the air is
          {{ confidence.word }} with {{ stats?.reviewers.length ?? 0 }} independent observers.
        </p>
      </div>
      <span class="f-glyph" aria-hidden="true">{{ condition.glyph }}</span>
    </div>

    <div class="f-stats">
      <div class="f-stat"><small>Temperature</small><b>{{ formatNumber(report?.trusted) }}°</b></div>
      <div class="f-stat"><small>Feels like</small><b>{{ formatNumber(report?.raw) }}°</b></div>
      <div class="f-stat"><small>Pressure</small><b>{{ formatSigned(pressure) }}</b></div>
      <div class="f-stat"><small>Wind</small><b>{{ wind }}</b></div>
    </div>

    <div class="f-columns">
      <div>
        <h2 class="f-h2">Outlook</h2>
        <p v-if="outlook.length < 2" class="f-empty">Not enough dated observations to draw an outlook.</p>
        <template v-else>
          <svg class="f-outlook" viewBox="0 0 600 150" role="img" aria-label="Daily mean reputation outlook">
            <line x1="0" y1="18" x2="600" y2="18" stroke="#d3e2f0" />
            <line x1="0" y1="73" x2="600" y2="73" stroke="#d3e2f0" stroke-dasharray="4 4" />
            <line x1="0" y1="128" x2="600" y2="128" stroke="#d3e2f0" />
            <text x="4" y="14" font-size="9" fill="#657a8f">100°</text>
            <text x="4" y="70" font-size="9" fill="#657a8f">50°</text>
            <text x="4" y="125" font-size="9" fill="#657a8f">0°</text>
            <path :d="path" fill="none" stroke="#2c6ea8" stroke-width="2.5" stroke-linejoin="round" transform="translate(34, 18)" />
          </svg>
          <div class="f-hist-labels"><span>{{ formatDate(outlook[0].day) }}</span><span>{{ formatDate(outlook.at(-1)!.day) }}</span></div>
          <p class="f-prose" style="font-size: 13px; margin-top: 8px">
            Daily means over {{ outlook.length }} observation days. Points are independent means, not a forecast model.
          </p>
        </template>

        <h2 class="f-h2">Advisories</h2>
        <p v-if="!stats?.signals.length" class="f-empty">No advisories in effect.</p>
        <div v-for="s in stats?.signals ?? []" :key="s.code" class="f-advisory" :class="s.level">
          <b>{{ s.level }}</b>{{ s.text }}
        </div>

        <h2 class="f-h2">Station log</h2>
        <p v-if="agent.feedbackSince" class="f-empty">Log begins {{ formatDate(agent.feedbackSince) }}.</p>
        <p v-if="!agent.feedback.length" class="f-empty">No readings.</p>
        <div v-else>
          <div class="f-obs head"><span>#</span><span>Reading</span><span>Observer</span><span class="num">Value</span><span class="num">Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="f-obs" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'bare value' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> [{{ FLAG_INFO[f].label }}]</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" class="f-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}°</span>
              <span class="num">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </div>
      </div>

      <aside>
        <div class="f-panel">
          <h3>Station details</h3>
          <dl class="f-spec">
            <dt>Operator</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else>—</span></dd>
            <dt>Agent wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (operator)' : '' }}</dd>
            <dt>Data sheet</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline' : '—' }}</span></dd>
            <dt>Instruments</dt><dd>{{ file?.services.map((s) => s.name).join(', ') || 'none' }}</dd>
            <dt>Opened</dt><dd>{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</dd>
            <dt>Evidence</dt><dd>{{ tierWords[report?.strength.tier ?? 'none'] }}</dd>
            <dt>Readings</dt><dd>{{ stats?.coverage.total ?? 0 }} · {{ stats?.coverage.dated ?? 0 }} dated</dd>
            <dt>Transactions</dt><dd>{{ stats?.coverage.withTx ?? 0 }} of {{ stats?.coverage.total ?? 0 }}</dd>
            <dt>Effective observers</dt><dd>{{ formatNumber(scores?.clientsEff, 2) }}</dd>
          </dl>
          <p class="f-mono" style="margin-top: 10px"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></p>
        </div>
        <div class="f-panel" style="margin-top: 14px">
          <h3>What changed the temperature</h3>
          <p v-for="step in report?.waterfall ?? []" :key="step.id" style="margin: 0 0 5px; font-size: 13px" :title="step.rule">
            {{ step.label }} <b>{{ formatNumber(step.average) }}°</b>
            <span class="soft">{{ step.id === 'all' ? '' : formatSigned(step.delta) }}</span>
          </p>
        </div>
        <div class="f-panel" style="margin-top: 14px">
          <h3>Observers</h3>
          <ul class="f-list">
            <li v-for="r in stats?.reviewers.slice(0, 9) ?? []" :key="r.client">
              <span><RouterLink :to="to.reviewer(r.client)" class="f-mono">{{ shortAddress(r.client) }}</RouterLink></span>
              <span class="soft">{{ formatPercent(r.share) }} of readings</span>
            </li>
          </ul>
        </div>
        <details v-if="rawJson" class="f-panel" style="margin-top: 14px"><summary class="f-kicker">Registration file</summary><pre>{{ rawJson }}</pre></details>
      </aside>
    </div>
  </template>
</template>
