<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { letterGrade, ring, stdDev } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()

const nodes = computed(() =>
  (stats.value?.reviewers ?? []).slice(0, 14).map((r, i, list) => ({
    r,
    i,
    ...ring(i, list.length, 132, 300, 205),
    callout: i + 1,
  })),
)
const live = computed(() => (agent.value?.feedback ?? []).filter((f) => !f.revoked).map((f) => f.value))
const tolerance = computed(() => stdDev(live.value))
const fit = computed(() => (report.value?.raw && report.value.trusted !== null ? report.value.trusted / report.value.raw : null))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const status = computed(() => (stats.value?.level === 'high' ? 'REJECT' : stats.value?.level === 'warn' ? 'REVIEW' : live.value.length ? 'ACCEPT' : 'UNRATED'))
const statusTone = computed(() => (stats.value?.level === 'high' ? 'bad' : stats.value?.level === 'warn' ? 'warn' : live.value.length ? 'ok' : ''))
// Dimension line y-position and ticks for the trusted / raw comparison.
const dims = computed(() => {
  const raw = report.value?.raw ?? null
  const trusted = report.value?.trusted ?? null
  return { raw, trusted, rawY: raw === null ? null : 388 - raw * 1.05, trustedY: trusted === null ? null : 388 - trusted * 1.05 }
})
</script>

<template>
  <p v-if="error" class="bp-err">{{ error }} <button @click="reload">RETRY</button></p>
  <p v-else-if="loading || agent === undefined" class="bp-empty">Opening drawing…</p>
  <template v-else-if="agent === null">
    <p class="bp-kicker">DRAWING NOT FOUND</p>
    <h1 class="bp-h1">No part {{ id }} on this site.</h1>
  </template>
  <template v-else>
    <p class="bp-kicker"><RouterLink :to="to.agents()">PARTS SCHEDULE</RouterLink> / DWG {{ agent.tokenId }} / REV {{ stats?.coverage.total ?? 0 }}</p>
    <div class="bp-title">
      <div>
        <h1 class="bp-h1">{{ file === undefined ? '…' : name }}</h1>
        <p class="bp-prose">{{ file?.description ?? 'No description supplied with the registration file.' }}</p>
        <p class="bp-note">
          <span class="bp-tag">PART {{ agent.tokenId }}</span>
          <span class="bp-tag">{{ chain.name }}</span>
          <span v-if="agent.createdAt" class="bp-tag">ISSUED {{ formatDate(agent.createdAt) }}</span>
          <span v-if="file?.active === false" class="bp-tag">INACTIVE</span>
        </p>
      </div>
      <div class="bp-panel">
        <h3>Inspection status</h3>
        <p style="margin: 0 0 8px"><span class="bp-stamp" :class="statusTone">{{ status }}</span></p>
        <div class="bp-kv"><span>Weighted rating</span><b>{{ formatNumber(report?.trusted) }}</b></div>
        <div class="bp-kv"><span>Raw mean</span><b>{{ formatNumber(report?.raw) }}</b></div>
        <div class="bp-kv"><span>Fit (weighted / raw)</span><b>{{ fit === null ? '—' : formatPercent(fit) }}</b></div>
        <div class="bp-kv"><span>Tolerance (σ)</span><b>{{ formatNumber(tolerance, 2) }}</b></div>
        <div class="bp-kv"><span>Grade</span><b>{{ grade }}</b></div>
      </div>
    </div>

    <h2 class="bp-h2">Assembly drawing · agent and certifying reviewers</h2>
    <div class="tb-wrap">
      <svg class="tb-svg" viewBox="0 0 600 430" role="img" aria-label="Agent assembly diagram">
        <defs>
          <marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill="#6fdcff" />
          </marker>
        </defs>
        <rect x="10" y="10" width="580" height="360" class="line" />
        <circle cx="300" cy="205" r="134" class="dash" />
        <circle cx="300" cy="205" r="90" class="dash" />
        <line v-for="n in nodes" :key="`e${n.i}`" x1="300" y1="205" :x2="n.x" :y2="n.y" class="edge" :class="{ heavy: (n.r.weightShare ?? 0) > 0.25 }" :stroke-width="Math.max(1, (n.r.weightShare ?? 0) * 14)" />
        <circle cx="300" cy="205" r="46" class="line" stroke="#6fdcff" stroke-width="1.5" />
        <text x="300" y="198" text-anchor="middle" font-size="26">{{ formatScore(report?.trusted ?? 0) }}</text>
        <text x="300" y="216" text-anchor="middle" class="dim" font-size="9">PART {{ agent.tokenId }}</text>
        <text x="300" y="229" text-anchor="middle" class="dim" font-size="8">{{ (file?.name ?? 'AGENT').slice(0, 22).toUpperCase() }}</text>
        <g v-for="n in nodes" :key="`n${n.i}`">
          <circle :cx="n.x" :cy="n.y" r="13" class="line" :stroke="(n.r.weightShare ?? 0) > 0.25 ? '#6fdcff' : 'rgba(190,225,255,.42)'" />
          <text :x="n.x" :y="n.y + 3" text-anchor="middle" font-size="8">{{ n.callout }}</text>
          <text :x="n.x + (n.x > 300 ? 18 : -18)" :y="n.y + 3" :text-anchor="n.x > 300 ? 'start' : 'end'" class="dim" font-size="7">{{ shortAddress(n.r.client) }}</text>
        </g>
        <!-- Dimension lines for raw vs weighted -->
        <g v-if="dims.raw !== null && dims.trusted !== null">
          <line x1="380" :y1="dims.rawY ?? 388" x2="470" :y2="dims.rawY ?? 388" class="dash" marker-start="url(#arrow)" marker-end="url(#arrow)" />
          <text x="476" :y="(dims.rawY ?? 388) + 3" class="dim" font-size="8">RAW {{ formatNumber(dims.raw) }}</text>
          <line x1="380" :y1="dims.trustedY ?? 388" x2="470" :y2="dims.trustedY ?? 388" class="edge" marker-start="url(#arrow)" marker-end="url(#arrow)" />
          <text x="476" :y="(dims.trustedY ?? 388) + 3" class="cyan" font-size="8">WTD {{ formatNumber(dims.trusted) }}</text>
        </g>
        <text x="20" y="386" class="dim" font-size="8">0</text>
        <text x="20" y="278" class="dim" font-size="8">100</text>
        <line x1="34" y1="388" x2="34" y2="278" class="line" />
        <line x1="380" y1="399" x2="580" y2="399" class="line" />
        <text x="380" y="412" class="dim" font-size="8">CERTIFYING REVIEWERS: {{ nodes.length }} OF {{ stats?.reviewers.length ?? 0 }} SHOWN</text>
      </svg>
    </div>

    <div class="bp-cols">
      <div>
        <h2 class="bp-h2">Callouts</h2>
        <div v-if="!nodes.length" class="bp-empty">No certifying reviewers.</div>
        <div v-else class="bp-callout">
          <template v-for="n in nodes" :key="n.i">
            <span class="n">{{ n.callout }}</span>
            <span><RouterLink :to="to.reviewer(n.r.client)" class="bp-mono">{{ shortAddress(n.r.client) }}</RouterLink></span>
            <span class="soft">{{ n.r.rows }} row{{ n.r.rows === 1 ? '' : 's' }} · {{ formatPercent(n.r.weightShare) }} of weight · avg {{ formatNumber(n.r.average) }}</span>
          </template>
        </div>

        <h2 class="bp-h2">Non-conformances</h2>
        <p v-if="!stats?.signals.length" class="bp-empty">None recorded.</p>
        <ul v-else class="bp-list">
          <li v-for="s in stats.signals" :key="s.code"><b :class="s.level === 'high' ? 'bp-err' : ''">{{ s.level.toUpperCase() }}</b> · {{ s.text }}</li>
        </ul>

        <h2 class="bp-h2">Inspection log</h2>
        <p v-if="agent.feedbackSince" class="bp-note">LOG BEGINS {{ formatDate(agent.feedbackSince) }}</p>
        <p v-if="!agent.feedback.length" class="bp-empty">No certificates on file.</p>
        <div v-else>
          <div class="bp-row head"><span>No.</span><span>Certificate</span><span>Reviewer</span><span class="num">Value</span><span class="num">Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="bp-row" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ String(i + 1).padStart(2, '0') }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'bare value' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> [{{ FLAG_INFO[f].label }}]</span>
              </span>
              <span class="bp-mono">{{ shortAddress(row.client) }}</span>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num" :class="{ 'bp-err': (stats?.rows[i]?.weight ?? 1) < 1 }">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </div>
      </div>

      <aside>
        <h2 class="bp-h2" style="margin-top: 0">Specification</h2>
        <dl class="bp-spec">
          <dt>Part number</dt><dd>{{ agent.tokenId }}</dd>
          <dt>Supplier</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else>—</span></dd>
          <dt>Agent wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ agent.agentWallet }}</a><span v-else>—</span>{{ walletIsOwner ? ' (supplier)' : '' }}</dd>
          <dt>Data sheet</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline data' : 'not supplied' }}</span></dd>
          <dt>Services</dt><dd>{{ file?.services.length ? file.services.map((s) => s.name).join(', ') : 'none declared' }}</dd>
          <dt>Trust models</dt><dd>{{ file?.supportedTrust.length ? file.supportedTrust.join(', ') : 'none declared' }}</dd>
          <dt>Issued</dt><dd>{{ agent.createdAt ? formatDate(agent.createdAt) : 'not on record' }}</dd>
          <dt>Feedback files</dt><dd>{{ stats?.coverage.withUri ?? 0 }} of {{ stats?.coverage.total ?? 0 }}</dd>
          <dt>Transactions</dt><dd>{{ stats?.coverage.withTx ?? 0 }} of {{ stats?.coverage.total ?? 0 }}</dd>
        </dl>
        <p class="bp-note" style="margin-top: 12px">
          <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004SCAN ↗</a>
        </p>
        <h2 class="bp-h2">Reading the score</h2>
        <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="bp-prose" style="font-size: 12px; margin: 0 0 6px">{{ reason }}</p>
        <p class="bp-note">
          Largest reviewer shifts the raw mean by
          {{ formatSigned(stats?.reviewers[0]?.shiftWithout) }}.
        </p>
        <details v-if="rawJson"><summary class="bp-note">REGISTRATION FILE</summary><pre>{{ rawJson }}</pre></details>
      </aside>
    </div>
  </template>
</template>
