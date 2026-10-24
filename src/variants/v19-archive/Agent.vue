<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { accessionYear, callNumberOf, conditionOf, seriesOf } from './archive'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
const call = computed(() => callNumberOf(props.id))
const series = computed(() => seriesOf(report.value?.trusted))
const condition = computed(() => conditionOf(agent.value?.feedback.filter((f) => f.revoked).length ?? 0, stats.value?.rows.filter((r) => r.flags.length).length ?? 0))
</script>

<template>
  <p v-if="error" class="x-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="x-empty">Pulling the folder…</p>
  <template v-else-if="agent === null">
    <p class="x-kicker">Not in the register</p>
    <h1 class="x-h1">Call number {{ call }} returns nothing.</h1>
  </template>
  <template v-else>
    <p class="x-kicker"><RouterLink :to="to.agents()">Accession register</RouterLink> / {{ call }}</p>
    <div class="x-sheet">
      <div class="x-sheet-head">
        <div>
          <div class="x-call">{{ call }} · SERIES {{ series.code }} · {{ accessionYear(agent.createdAt) }}</div>
          <h1>{{ name }}</h1>
          <div class="x-line" style="border-bottom: 0; max-width: 520px">
            <span>Holder</span>
            <span><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else>unknown</span></span>
          </div>
        </div>
        <div class="x-stamps">
          <span class="x-stamp" :class="series.tone">{{ series.stamp }}</span>
          <span class="x-stamp" :class="(stats?.signals.length ?? 0) ? 'poor' : 'good'">{{ (stats?.signals.length ?? 0) ? 'REVIEW FLAGGED' : 'CLEARED' }}</span>
        </div>
      </div>

      <dl class="x-spec">
        <dt>Call number</dt><dd>{{ call }}</dd>
        <dt>Record no.</dt><dd>#{{ agent.tokenId }}</dd>
        <dt>Date of accession</dt><dd>{{ agent.createdAt ? formatDate(agent.createdAt) : 'undated' }}</dd>
        <dt>Extent</dt><dd>{{ stats?.coverage.total ?? 0 }} item{{ stats?.coverage.total === 1 ? '' : 's' }} ({{ stats?.coverage.dated ?? 0 }} dated, {{ stats?.coverage.withUri ?? 0 }} with a file)</dd>
        <dt>Agent wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (same as holder)' : '' }}</dd>
        <dt>Subject terms</dt><dd>{{ file?.services.map((s) => s.name).join('; ') || 'none declared' }}</dd>
        <dt>Trust terms</dt><dd>{{ file?.supportedTrust.join('; ') || 'none declared' }}</dd>
        <dt>Registration file</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'held inline' : '—' }}</span></dd>
        <dt>Condition</dt><dd>{{ condition }}</dd>
        <dt>Full votes</dt><dd>{{ formatNumber(scores?.effectiveCount) }} · lower bound {{ formatNumber(report?.lcb) }}</dd>
      </dl>

      <h2 class="x-h2">Scope and content</h2>
      <p class="x-prose">{{ file?.description ?? 'The registration file carries no description. The record consists of the on-chain entry and its item list.' }}</p>
      <p class="x-prose">{{ report?.headline ?? 'No rating has been filed.' }}</p>
      <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="x-prose" style="font-size: 11.5px">— {{ reason }}</p>

      <div class="x-columns" style="margin-top: 16px">
        <div>
          <h2 class="x-h2" style="margin-top: 0">Administrative history · how the score was filed</h2>
          <table class="x-table">
            <thead><tr><th>Treatment</th><th>Rule applied</th><th class="num">After</th><th class="num">Δ</th><th class="num">Items</th></tr></thead>
            <tbody>
              <tr v-for="step in report?.waterfall ?? []" :key="step.id">
                <td>{{ step.label }}</td>
                <td class="soft" style="white-space: normal">{{ step.rule }}</td>
                <td class="num">{{ step.average === null ? '—' : formatNumber(step.average) }}</td>
                <td class="num">{{ step.delta === null ? '—' : formatSigned(step.delta) }}</td>
                <td class="num">{{ step.rows }}</td>
              </tr>
            </tbody>
          </table>

          <h2 class="x-h2">Item list</h2>
          <p v-if="!agent.feedback.length" class="x-empty">The folder contains no items.</p>
          <template v-else>
            <div class="x-item head"><span class="idx">No.</span><span>Item</span><span>Depositor</span><span class="num">Score</span><span class="num">Wt</span></div>
            <template v-for="(row, i) in agent.feedback" :key="i">
              <div class="x-item" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
                <span class="idx">{{ i + 1 }}</span>
                <span>
                  <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                  <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'a bare score' }}</span>
                  <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> ({{ FLAG_INFO[f].label }})</span>
                </span>
                <RouterLink :to="to.reviewer(row.client)" class="x-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
                <span class="num">{{ formatScore(row.value) }}</span>
                <span class="num">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
              </div>
              <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
            </template>
          </template>
        </div>

        <aside class="x-side">
          <span class="x-tape">Restricted? No — open access</span>
          <h2 class="x-h2">Conservation notes</h2>
          <p v-if="!stats?.signals.length" class="x-empty">No conservation signal was raised.</p>
          <ul v-else class="x-list">
            <li v-for="s in stats.signals" :key="s.code" style="display: block">
              <b :class="s.level === 'high' ? 'x-flag' : ''">{{ s.code }}</b>
              <div class="soft" style="font-size: 11px">{{ s.text }}</div>
            </li>
          </ul>

          <h2 class="x-h2">Related material · depositors</h2>
          <ul class="x-list">
            <li v-for="r in stats?.reviewers ?? []" :key="r.client">
              <span><RouterLink :to="to.reviewer(r.client)" class="x-mono">{{ shortAddress(r.client) }}</RouterLink></span>
              <span class="soft">{{ r.rows }} · {{ formatPercent(r.weightShare) }}</span>
            </li>
          </ul>

          <h2 class="x-h2">Finding aid</h2>
          <ul class="x-list">
            <li><span>Full votes</span><span>{{ formatNumber(scores?.effectiveCount) }}</span></li>
            <li><span>Distinct depositors</span><span>{{ scores?.distinctClients ?? '—' }}</span></li>
            <li><span>Surviving weight</span><span>{{ formatPercent(scores?.trustMass) }}</span></li>
            <li><span>Equivalent voices</span><span>{{ formatNumber(scores?.clientsEff) }}</span></li>
          </ul>
          <p class="x-mono" style="margin-top: 12px"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></p>
          <details v-if="rawJson"><summary class="x-kicker">Registration file (raw)</summary><pre>{{ rawJson }}</pre></details>
        </aside>
      </div>
    </div>
  </template>
</template>
