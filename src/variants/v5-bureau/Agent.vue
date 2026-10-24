<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl, txExplorerUrl } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { GRADE_RULE, letterGrade } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import Gauge from './Gauge.vue'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
// Key factors: the rules that moved the score most, then thin evidence.
const factors = computed(() => {
  const r = report.value
  if (!r) return []
  const out = r.waterfall
    .filter((s) => s.id !== 'all' && s.delta !== null && Math.abs(s.delta) >= 0.05)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    .map((s) => ({ text: `${s.label}: ${formatSigned(s.delta)} points (${s.rows} reports)`, rule: s.rule }))
  for (const reason of r.strength.reasons) out.push({ text: reason, rule: 'Evidence strength' })
  return out.slice(0, 5)
})
const disputes = computed(() => (agent.value?.feedback ?? []).map((row, index) => ({ row, index })).filter(({ row }) => row.revoked || row.responses?.length))
const derogatory = computed(() => stats.value?.signals.filter((s) => s.level !== 'info') ?? [])
const open = ref<number>()
const STATUS = (flags: RowFlag[], weight: number) => (flags.includes('revoked') ? 'CLOSED' : weight === 0 ? 'VOID' : weight < 1 ? 'DISCOUNTED' : 'CURRENT')
function flagText(f: RowFlag[]): string {
  return f.filter((x) => x !== 'revoked').map((x) => FLAG_INFO[x].label).join(', ')
}
</script>

<template>
  <p class="mono"><RouterLink :to="to.agents()">← Subject index</RouterLink></p>
  <p v-if="error" class="u-notice">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="soft mono">Retrieving file…</p>
  <p v-else-if="agent === null" class="u-notice">No subject #{{ id }} in the {{ chain.name }} identity registry.</p>
  <template v-else>
    <div v-if="stats && agent.feedback.length" class="u-stamp" :class="{ ok: stats.level === 'clean' || stats.level === 'info' }">
      {{ stats.level === 'high' ? 'Adverse' : stats.level === 'warn' ? 'Under review' : 'In good standing' }}
    </div>

    <section class="u-sec">
      <h2><span>§1</span> Subject identification</h2>
      <div class="u-fields">
        <div class="u-field" style="grid-column: span 2"><label>Name</label><div style="font-weight: 700">{{ file === undefined ? '…' : name }}</div></div>
        <div class="u-field"><label>Subject ID</label><div>{{ chain.chainId }}:{{ agent.tokenId }}</div></div>
        <div class="u-field"><label>Status</label><div>{{ file?.active === true ? 'ACTIVE' : file?.active === false ? 'INACTIVE' : 'UNDECLARED' }}{{ file?.x402Support ? ' · X402' : '' }}</div></div>
        <div class="u-field"><label>Guarantor (owner)</label><div><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" :title="agent.owner">{{ agent.owner }}</RouterLink><template v-else>—</template></div></div>
        <div class="u-field"><label>Operating wallet</label><div><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ agent.agentWallet }}</a><template v-else>NOT SET</template>{{ walletIsOwner ? ' (= guarantor)' : '' }}</div></div>
        <div class="u-field"><label>Date opened</label><div>{{ agent.createdAt ? formatDate(agent.createdAt) : 'UNRECORDED' }}</div></div>
        <div class="u-field"><label>Filing</label><div><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" :title="agent.agentURI ?? ''">{{ agent.agentURI }}</a><template v-else>{{ agent.agentURI ? 'INLINE' : 'NONE' }}</template></div></div>
        <div class="u-field"><label>Trust models</label><div>{{ file?.supportedTrust?.join(', ') || '—' }}</div></div>
        <div class="u-field"><label>Cross-reference</label><div><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></div></div>
      </div>
      <p v-if="file?.description" style="margin: 8px 0 0">{{ file.description }}</p>
      <p v-else-if="file === null" class="u-notice" style="margin-top: 8px">Filing unreadable (unreachable host, CORS, or not JSON). Chain records only.</p>
    </section>

    <section v-if="report && stats && scores && agent.feedback.length" class="u-sec">
      <h2><span>§2</span> Score summary</h2>
      <div class="u-score">
        <div style="text-align: center">
          <Gauge :value="report.trusted" />
          <p class="mono" style="margin: 0">TRUSTED {{ formatNumber(report.trusted) }} · FLOOR {{ formatNumber(report.lcb) }}</p>
        </div>
        <div>
          <p style="margin: 0" :title="GRADE_RULE"><span class="u-grade" :class="`u-g-${grade}`">{{ grade }}</span> <span class="soft mono">grade · {{ report.strength.tier }} evidence</span></p>
          <p style="margin: 6px 0 10px"><b>{{ report.headline }}</b></p>
          <h3 class="mono" style="font-size: 11px; text-transform: uppercase">Key factors</h3>
          <ol class="mono" style="margin: 4px 0 0; padding-left: 20px; font-size: 12px">
            <li v-for="f in factors" :key="f.text" :title="f.rule">{{ f.text }}</li>
            <li v-if="!factors.length">No rule moved the score.</li>
          </ol>
        </div>
      </div>
      <div class="u-fields" style="margin-top: 12px">
        <div class="u-field"><label>Raw (registry)</label><div>{{ formatNumber(agent.reputation?.average ?? report.raw) }}</div></div>
        <div class="u-field"><label>Median</label><div>{{ formatNumber(scores.median) }}</div></div>
        <div class="u-field"><label>Bayesian</label><div>{{ formatNumber(scores.bayes) }}</div></div>
        <div class="u-field"><label>Votes counted</label><div>{{ formatPercent(scores.trustMass) }}</div></div>
        <div class="u-field"><label>8004scan</label><div>{{ scan.data.value ? formatNumber(scan.data.value.total) : scan.loading.value ? '…' : '—' }}</div></div>
        <div class="u-field"><label>Ecosystem mean</label><div>{{ formatNumber(ecosystem.data.value?.averageFeedback) }}</div></div>
      </div>
    </section>
    <section v-else class="u-sec"><h2><span>§2</span> Score summary</h2><p class="mono">NO REPORTS ON FILE · NOT RATED</p></section>

    <template v-if="report && stats && agent.feedback.length">
      <section class="u-sec">
        <h2><span>§3</span> Derogatory marks · {{ derogatory.length }}</h2>
        <p v-if="!derogatory.length" class="mono soft">NONE</p>
        <p v-for="s in derogatory" :key="s.code" style="margin: 4px 0"><span class="u-mark" :class="s.level === 'high' ? 'bad' : 'warn'">{{ s.level }}</span>{{ s.text }}</p>
      </section>

      <section class="u-sec">
        <h2><span>§4</span> Reporting sources · {{ stats.reviewers.length }}</h2>
        <div class="u-scroll">
          <table class="u-table">
            <thead><tr><th>Source</th><th>Opened</th><th>Last</th><th class="num">Reports</th><th class="num">Avg</th><th class="num">Weight share</th><th class="num">Impact</th><th>Remarks</th></tr></thead>
            <tbody>
              <tr v-for="r in stats.reviewers" :key="r.client">
                <td><RouterLink :to="to.reviewer(r.client)">{{ shortAddress(r.client) }}</RouterLink></td>
                <td>{{ r.first ? formatDate(r.first) : '—' }}</td>
                <td>{{ r.last ? formatDate(r.last) : '—' }}</td>
                <td class="num">{{ r.rows }}<template v-if="r.revoked"> ({{ r.revoked }} closed)</template></td>
                <td class="num">{{ formatNumber(r.average) }}</td>
                <td class="num">{{ formatPercent(r.weightShare) }}</td>
                <td class="num">{{ formatSigned(r.shiftWithout === null ? null : -r.shiftWithout) }}</td>
                <td>{{ flagText(r.flags) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="u-sec">
        <h2><span>§5</span> Report history · {{ agent.feedback.length }}<template v-if="agent.feedbackSince"> · dated from {{ formatDate(agent.feedbackSince) }}</template></h2>
        <div class="u-scroll">
          <table class="u-table">
            <thead><tr><th>Date</th><th>Source</th><th class="num">Value</th><th>Status</th><th class="num">Weight</th><th>Category</th><th>Narrative</th></tr></thead>
            <tbody>
              <template v-for="(row, i) in agent.feedback" :key="i">
                <tr class="click" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
                  <td>{{ row.createdAt ? formatDate(row.createdAt) : '—' }}</td>
                  <td><RouterLink :to="to.reviewer(row.client)" @click.stop>{{ shortAddress(row.client) }}</RouterLink></td>
                  <td class="num"><b>{{ formatScore(row.value) }}</b></td>
                  <td>{{ STATUS(stats.rows[i]?.flags ?? [], stats.rows[i]?.weight ?? 1) }}</td>
                  <td class="num">{{ formatNumber(stats.rows[i]?.weight, 2) }}</td>
                  <td>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || '—' }}</td>
                  <td><FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" /></td>
                </tr>
                <tr v-if="open === i"><td colspan="7"><TxPanel :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" /></td></tr>
              </template>
            </tbody>
          </table>
        </div>
        <p class="soft mono" style="font-size: 11px">Select a report to audit its transaction, file and payment proof.</p>
      </section>

      <section class="u-sec">
        <h2><span>§6</span> Disputes & statements · {{ disputes.length }}</h2>
        <p v-if="!disputes.length" class="mono soft">NONE ON FILE</p>
        <table v-else class="u-table">
          <tbody>
            <tr v-for="d in disputes" :key="d.index">
              <td>{{ shortAddress(d.row.client) }} · {{ formatScore(d.row.value) }}</td>
              <td>
                <span v-if="d.row.revoked" class="u-mark">withdrawn by source</span>
                <span v-for="(r, j) in d.row.responses ?? []" :key="j" class="u-mark ok">
                  statement by {{ shortAddress(r.responder) }}<template v-if="r.createdAt"> {{ formatDate(r.createdAt) }}</template>
                  <a v-if="r.txHash" :href="txExplorerUrl(chain, r.txHash)" target="_blank" rel="noopener noreferrer"> ↗</a>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <section class="u-sec">
      <h2><span>§7</span> Declared services</h2>
      <p v-if="!file?.services?.length" class="mono soft">{{ file === undefined ? '…' : 'NONE DECLARED' }}</p>
      <table v-else class="u-table">
        <tbody><tr v-for="s in file.services" :key="s.name + s.endpoint"><td><b>{{ s.name }}</b></td><td>{{ s.endpoint }}</td><td>{{ s.version ? `v${s.version}` : '' }}</td></tr></tbody>
      </table>
      <details v-if="rawJson" style="margin-top: 8px"><summary class="mono">Attachment A — filing as received</summary><pre>{{ rawJson }}</pre></details>
    </section>
  </template>
</template>
