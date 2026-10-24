<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { letterGrade, ring, sparkPath } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { coordsOf, markRadius, pointOf, terrainOf } from './atlas'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
const coords = computed(() => coordsOf(props.id))
const terrain = computed(() => terrainOf(report.value?.trusted))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const site = computed(() => pointOf(props.id, 420, 320, 60))
const surveyors = computed(() =>
  (stats.value?.reviewers ?? []).slice(0, 12).map((r, i, all) => ({ ...r, at: ring(i, all.length, 92, 210, 160) })),
)
const profile = computed(() => {
  const rows = (report.value?.waterfall ?? []).filter((s) => s.average !== null)
  const path = sparkPath(rows.map((s) => s.average!), 620, 100, 0, 100)
  return { rows, path }
})
const elevation = computed(() => Math.round((report.value?.trusted ?? 0) * 10))
</script>

<template>
  <p v-if="error" class="a-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="a-empty">Charting the place…</p>
  <template v-else-if="agent === null">
    <p class="a-kicker">Uncharted</p>
    <h1 class="a-h1">Place {{ id }} does not appear on this sheet.</h1>
  </template>
  <template v-else>
    <p class="a-kicker"><RouterLink :to="to.agents()">Gazetteer</RouterLink> / {{ chain.name }} / place {{ agent.tokenId }}</p>
    <div class="a-profile">
      <div>
        <h1 class="a-h1" style="margin-bottom: 6px">{{ name }}</h1>
        <p class="a-coords" style="margin: 0">{{ coords.text }} · {{ terrain.name }} · elevation {{ elevation }} ft</p>
      </div>
      <div style="text-align: right">
        <b>{{ formatNumber(report?.trusted) }}</b>
        <div class="a-coords">trusted elevation · grade {{ grade }}</div>
      </div>
    </div>

    <div class="a-columns" style="margin-top: 22px">
      <div>
        <h2 class="a-h2" style="margin-top: 0">Site plan</h2>
        <div class="a-minimap">
          <svg class="a-map" viewBox="0 0 420 320" role="img" aria-label="Site plan with surveyors around the place">
            <line v-for="x in 8" :key="`v${x}`" :x1="(x - 1) * 60" y1="0" :x2="(x - 1) * 60" y2="320" :class="x % 4 === 1 ? 'a-grat-major' : 'a-grat'" />
            <line v-for="y in 6" :key="`h${y}`" x1="0" :y1="(y - 1) * 64" x2="420" :y2="(y - 1) * 64" :class="y % 3 === 1 ? 'a-grat-major' : 'a-grat'" />
            <circle cx="210" cy="160" r="120" class="a-contour" />
            <circle cx="210" cy="160" r="86" class="a-contour" />
            <circle cx="210" cy="160" r="52" class="a-contour" />
            <line
              v-for="s in surveyors"
              :key="`l${s.client}`"
              :x1="site.x"
              :y1="site.y"
              :x2="s.at.x"
              :y2="s.at.y"
              stroke="rgba(29,59,54,.35)"
              stroke-width=".7"
              stroke-dasharray="2 2"
            />
            <circle class="a-mark" :class="terrain.tone" :cx="site.x" :cy="site.y" :r="markRadius(stats?.coverage.total)" />
            <text class="a-mark-num" :x="site.x" :y="site.y + 3" text-anchor="middle">{{ agent.tokenId.toString().slice(-2) }}</text>
            <g v-for="s in surveyors" :key="s.client">
              <circle cx="s.at.x" cy="s.at.y" r="4" fill="var(--a-paper)" stroke="var(--a-ink)" stroke-width=".9" />
              <text :x="s.at.x" :y="s.at.y - 7" text-anchor="middle" class="a-mark-label" font-size="7">{{ shortAddress(s.client) }}</text>
            </g>
            <g transform="translate(386 286)">
              <path d="M0 -14 L4 0 L0 14 L-4 0 Z" fill="var(--a-red)" />
              <text y="-18" text-anchor="middle" font-size="6" fill="var(--a-ink)">N</text>
            </g>
          </svg>
        </div>
        <p class="a-note">
          The place sits at the centre; the small marks are the surveyors who left soundings, placed by bearing only.
          {{ stats?.reviewers.length ?? 0 }} surveyor{{ stats?.reviewers.length === 1 ? '' : 's' }} in all.
        </p>

        <h2 class="a-h2">Elevation profile · the survey in steps</h2>
        <svg viewBox="0 0 620 120" class="a-map" style="background: transparent; border-bottom: 1px solid var(--a-rule)">
          <line x1="0" y1="100" x2="620" y2="100" class="a-grat-major" />
          <line x1="0" y1="50" x2="620" y2="50" class="a-grat" stroke-dasharray="3 4" />
          <line x1="0" y1="0" x2="620" y2="0" class="a-grat" stroke-dasharray="3 4" />
          <path :d="profile.path" fill="none" stroke="var(--a-red)" stroke-width="2" />
          <circle
            v-for="(s, i) in profile.rows"
            :key="s.id"
            :cx="(i / Math.max(1, profile.rows.length - 1)) * 620"
            :cy="100 - (s.average! / 100) * 100"
            r="3.5"
            fill="var(--a-red)"
          >
            <title>{{ s.label }}: {{ formatNumber(s.average) }}</title>
          </circle>
          <text x="2" y="12" font-size="8" fill="var(--a-soft)">100</text>
          <text x="2" y="112" font-size="8" fill="var(--a-soft)">0</text>
        </svg>
        <ul class="a-list" style="margin-top: 10px">
          <li v-for="step in report?.waterfall ?? []" :key="step.id">
            <span><b>{{ step.label }}</b> — {{ step.rule }}</span>
            <span class="soft">{{ step.average === null ? '—' : formatNumber(step.average) }}<template v-if="step.delta !== null"> ({{ formatSigned(step.delta) }})</template></span>
          </li>
        </ul>

        <h2 class="a-h2">Field notes</h2>
        <p v-if="!agent.feedback.length" class="a-empty">No soundings were recorded here.</p>
        <template v-else>
          <div class="a-field head"><span class="idx">No.</span><span>Note</span><span>Surveyor</span><span class="num">Elev.</span><span class="num">Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="a-field" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'a bare value' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> ({{ FLAG_INFO[f].label }})</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" class="a-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </template>
      </div>

      <aside class="a-side">
        <Sigil :seed="agent.tokenId.toString()" :image="file?.image" :size="64" :palette="['#a63a2a', '#b08a3e', '#1d3b36', '#64736b', '#3b514a']" />
        <h2 class="a-h2">Place file</h2>
        <dl class="a-spec">
          <dt>Number</dt><dd>#{{ agent.tokenId }}</dd>
          <dt>Holder</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ shortAddress(agent.owner) }}</RouterLink><span v-else>—</span></dd>
          <dt>Wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (same)' : '' }}</dd>
          <dt>Charted</dt><dd>{{ agent.createdAt ? formatDate(agent.createdAt) : 'undated' }}</dd>
          <dt>Services</dt><dd>{{ file?.services.map((s) => s.name).join(', ') || 'none' }}</dd>
          <dt>Trust</dt><dd>{{ file?.supportedTrust.join(', ') || 'none' }}</dd>
          <dt>Sheet</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline' : '—' }}</span></dd>
          <dt>Soundings</dt><dd>{{ stats?.coverage.total ?? 0 }} ({{ stats?.coverage.dated ?? 0 }} dated)</dd>
          <dt>Full votes</dt><dd>{{ formatNumber(scores?.effectiveCount) }}</dd>
          <dt>Prominence</dt><dd>{{ formatNumber(report?.lcb) }}</dd>
        </dl>
        <p class="a-mono" style="margin-top: 10px"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></p>

        <h2 class="a-h2">Surveyors</h2>
        <ul class="a-list">
          <li v-for="r in stats?.reviewers ?? []" :key="r.client">
            <span><RouterLink :to="to.reviewer(r.client)" class="a-mono">{{ shortAddress(r.client) }}</RouterLink></span>
            <span class="soft">{{ r.rows }} · {{ formatPercent(r.weightShare) }}</span>
          </li>
        </ul>

        <h2 class="a-h2">Marginalia</h2>
        <p class="a-note">{{ report?.headline ?? 'No soundings on record.' }}</p>
        <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="a-note">{{ reason }}</p>
        <details v-if="rawJson"><summary class="a-kicker">Registration sheet</summary><pre>{{ rawJson }}</pre></details>
      </aside>
    </div>
  </template>
</template>
