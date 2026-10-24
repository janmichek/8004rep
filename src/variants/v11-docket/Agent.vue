<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import type { StrengthTier } from '../../data/trustReport'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { letterGrade } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()

// The verdict is a reading of the record: evidence tier and risk together.
const verdict = computed(() => {
  if (!report.value || !stats.value) return { word: 'Pending', detail: 'The file is still being read.' }
  if (!agent.value?.feedback.length) return { word: 'No case', detail: 'No testimony has been entered.' }
  if (!report.value.trusted) return { word: 'Struck', detail: 'No testimony carries weight.' }
  if (stats.value.level === 'high') return { word: 'Disputed', detail: 'The record carries a high-risk finding.' }
  if (stats.value.level === 'warn') return { word: 'Reserved', detail: 'The record carries findings that need a look.' }
  if (report.value.strength.tier === 'strong') return { word: 'Upheld', detail: 'Strong evidence and no material objection.' }
  return { word: 'Noted', detail: 'Nothing objectionable, on thin or moderate evidence.' }
})
const tierWords: Record<StrengthTier, string> = { none: 'no usable evidence', thin: 'thin evidence', moderate: 'moderate evidence', strong: 'strong evidence' }
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const exhibits = computed(() => report.value?.waterfall.filter((s) => s.id !== 'all') ?? [])
</script>

<template>
  <p v-if="error" class="d-error">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="d-empty">Opening the file…</p>
  <template v-else-if="agent === null">
    <p class="d-kicker">No record</p>
    <h1 class="d-h1">Cause {{ id }} is not on the list.</h1>
  </template>
  <template v-else>
    <p class="d-kicker"><RouterLink :to="to.agents()">Cause list</RouterLink> / Cause No. {{ agent.tokenId }}</p>
    <h1 class="d-h1">{{ file === undefined ? '…' : name }}</h1>
    <div class="d-caption">
      <div><span class="d-label">Cause number</span><p class="d-mono" style="margin: 2px 0 0">#{{ agent.tokenId }}</p></div>
      <div><span class="d-label">Counsel of record</span><p class="d-mono" style="margin: 2px 0 0"><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ shortAddress(agent.owner) }}</RouterLink><span v-else>—</span></p></div>
      <div><span class="d-label">Filed</span><p style="margin: 2px 0 0">{{ agent.createdAt ? formatDate(agent.createdAt) : 'date not on record' }}</p></div>
      <div><span class="d-label">Agent wallet</span><p class="d-mono" style="margin: 2px 0 0"><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (counsel)' : '' }}</p></div>
      <div><span class="d-label">Registration file</span><p style="margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis"><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline data' : 'not filed' }}</span></p></div>
      <div><span class="d-label">Appearances</span><p style="margin: 2px 0 0"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan</a> · {{ file?.services?.length ?? 0 }} services</p></div>
    </div>

    <div class="d-verdict">
      <div>
        <p class="d-kicker">Verdict on the record</p>
        <h2>{{ verdict.word }} · grade {{ grade }}</h2>
        <p>{{ report?.headline ?? 'No reputation on record.' }}</p>
        <p class="d-motif">{{ verdict.detail }} Evidence: {{ tierWords[report?.strength.tier ?? 'none'] }}.</p>
      </div>
      <div class="stamp">{{ verdict.word }}<small>8004 · {{ chain.name }}</small></div>
    </div>

    <div class="d-figures">
      <div><small>Trusted score</small><b>{{ formatNumber(report?.trusted) }}</b></div>
      <div><small>Raw average</small><b>{{ formatNumber(report?.raw) }}</b></div>
      <div><small>Gap</small><b>{{ report?.raw != null && report?.trusted != null ? formatNumber(report.raw - report.trusted) : '—' }}</b></div>
      <div><small>Witnesses</small><b>{{ stats?.reviewers.length ?? 0 }}</b></div>
    </div>

    <div class="d-split">
      <div>
        <h2 class="d-h2">Statement of facts</h2>
        <p style="margin: 0 0 12px; max-width: 70ch">{{ file?.description ?? 'The registration file carries no description.' }}</p>
        <p class="d-motif">{{ file?.active === false ? 'The agent declares itself inactive. ' : '' }}{{ file?.x402Support ? 'It advertises x402 support. ' : '' }}<template v-for="t in file?.supportedTrust ?? []" :key="t"><span class="d-tag">{{ t }}</span></template><template v-for="s in file?.services ?? []" :key="s.name + s.endpoint"><span class="d-tag" :title="s.endpoint">{{ s.name }}</span></template></p>

        <h2 class="d-h2">Objections</h2>
        <p v-if="!stats?.signals.length" class="d-motif">None entered.</p>
        <ul v-else class="d-paras">
          <li v-for="s in stats.signals" :key="s.code"><span class="d-signal" :class="s.level">{{ s.level }}</span>{{ s.text }}</li>
        </ul>

        <h2 class="d-h2">Exhibits: how the score was reached</h2>
        <ul class="d-paras">
          <li v-for="e in exhibits" :key="e.id"><b>{{ e.label }}</b> — {{ e.rule }} <span class="soft">({{ e.rows }} row{{ e.rows === 1 ? '' : 's' }}, average {{ formatNumber(e.average) }}<template v-if="e.delta !== null">, {{ formatSigned(e.delta) }}</template>)</span></li>
        </ul>
        <p class="d-motif">The plain mean of every row is {{ formatNumber(report?.waterfall[0]?.average) }}; after all rules it is {{ formatNumber(report?.trusted) }}.</p>

        <h2 class="d-h2">Testimony</h2>
        <p v-if="agent.feedbackSince" class="d-motif">Dated testimony from {{ formatDate(agent.feedbackSince) }}.</p>
        <p v-if="!agent.feedback.length" class="d-empty">No testimony on file.</p>
        <div v-else class="d-testimony">
          <div class="d-row head"><span>No.</span><span>Testimony</span><span>Witness</span><span class="v">Value</span><span class="v">Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="d-row" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="n">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'a bare value' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="d-flag"> 〔{{ FLAG_INFO[f].label }}〕</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" class="d-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="v">{{ formatScore(row.value) }}</span>
              <span class="v" :class="{ 'd-error': (stats?.rows[i]?.weight ?? 1) < 1 }">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </div>
      </div>
      <aside class="d-side">
        <h2 class="d-h2" style="margin-top: 0">Witnesses</h2>
        <p v-if="!stats?.reviewers.length" class="d-motif">None.</p>
        <ul v-else class="d-list">
          <li v-for="r in stats.reviewers.slice(0, 12)" :key="r.client">
            <span><RouterLink :to="to.reviewer(r.client)" class="d-mono">{{ shortAddress(r.client) }}</RouterLink></span>
            <span class="soft">{{ r.rows }} row{{ r.rows === 1 ? '' : 's' }} · {{ formatPercent(r.share) }} · avg {{ formatNumber(r.average) }}</span>
          </li>
        </ul>
        <p class="d-motif" style="margin-top: 12px">
          <template v-if="stats?.reviewers[0]?.shiftWithout !== null && stats?.reviewers[0]?.shiftWithout !== undefined">
            Dropping the largest witness moves the raw average by {{ formatSigned(stats.reviewers[0].shiftWithout) }}.
          </template>
        </p>
        <h2 class="d-h2">Evidence strength</h2>
        <p v-for="reason in report?.strength.reasons ?? []" :key="reason">{{ reason }}</p>
        <h2 class="d-h2">Record coverage</h2>
        <p>
          {{ stats?.coverage.total ?? 0 }} rows, {{ stats?.coverage.dated ?? 0 }} dated,
          {{ stats?.coverage.withUri ?? 0 }} with a feedback file, {{ stats?.coverage.withTx ?? 0 }} with a transaction.
        </p>
        <details v-if="rawJson"><summary class="d-label">Registration file</summary><pre>{{ rawJson }}</pre></details>
      </aside>
    </div>
  </template>
</template>
