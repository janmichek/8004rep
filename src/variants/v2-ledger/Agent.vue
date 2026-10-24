<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl, txExplorerUrl } from '../../chains'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { effectiveCount, runningAverage, sparkPath100 } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

const verdict = computed(() => {
  const r = report.value
  const s = stats.value
  if (!r || !s) return ''
  if (r.trusted === null) return 'Too little honest evidence to print a verdict.'
  const gap = r.raw !== null ? r.raw - r.trusted : 0
  return gap > 5 ? `Inflated by ${formatNumber(gap)} points` : s.level === 'high' ? 'Serious questions over its ratings' : r.strength.tier === 'strong' ? 'A record that holds up' : 'Promising, on thin evidence'
})
const quotes = computed(() => (agent.value?.feedback ?? []).filter((f) => f.feedbackURI && !f.revoked).slice(0, 2))
const trend = computed(() => {
  const pts = runningAverage(agent.value?.feedback ?? [])
  return { path: sparkPath100(pts.map((p) => p.average), 300, 60), from: pts[0]?.t, to: pts.at(-1)?.t }
})
const voices = computed(() => effectiveCount(stats.value?.reviewers.map((r) => r.rows) ?? []))
const open = ref<number>()
function flags(f: RowFlag[]): string {
  return f.filter((x) => x !== 'revoked').map((x) => FLAG_INFO[x].label).join(', ')
}
</script>

<template>
  <p class="l-byline"><RouterLink :to="to.agents()">← The Register</RouterLink></p>
  <p v-if="error" class="l-notice">Could not reach the record: {{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="l-deck">Checking the record…</p>
  <template v-else-if="agent === null">
    <p class="l-kicker">Correction</p>
    <h2 class="l-head">No agent No. {{ id }} on {{ chain.name }}</h2>
  </template>
  <template v-else>
    <p class="l-kicker">Profile · {{ chain.name }} · No. {{ agent.tokenId }}</p>
    <h2 class="l-head">{{ file === undefined ? '…' : name }}<template v-if="verdict">: {{ verdict.toLowerCase() }}</template></h2>
    <p class="l-deck">{{ file?.description ?? (file === null ? 'Its registration file could not be read; this profile relies on the chain alone.' : '') }}</p>
    <p class="l-byline">
      Registered {{ agent.createdAt ? formatDate(agent.createdAt) : 'on an unrecorded date' }} ·
      owner <RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="l-mono">{{ shortAddress(agent.owner) }}</RouterLink>
      · <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a>
      <template v-if="file?.active !== undefined"> · {{ file.active ? 'active' : 'inactive' }}</template>
      <template v-if="file?.x402Support"> · accepts x402</template>
    </p>

    <div class="l-grid">
      <article>
        <template v-if="report && stats && scores && agent.feedback.length">
          <div class="l-cols">
            <p>
              {{ report.headline }} The registry's own average stands at {{ formatNumber(report.raw) }} across {{ agent.feedback.length }} reviews.
              Once self-reviews, duplicates, bursts and monotonous raters are discounted, the trusted figure is {{ formatNumber(report.trusted) }}<template v-if="report.lcb !== null">, and no lower than {{ formatNumber(report.lcb) }} with 95% confidence</template>.
            </p>
            <p>
              {{ stats.reviewers.length }} address{{ stats.reviewers.length === 1 ? '' : 'es' }} wrote these reviews, speaking with roughly {{ formatNumber(voices) }} independent voice{{ voices === 1 ? '' : 's' }}
              once their volume is weighed. The median rating is {{ formatNumber(scores.median) }}; momentum over the last month reads {{ formatSigned(scores.momentum) }}.
              <template v-if="ecosystem.data.value"> The typical agent across the ecosystem rates {{ formatNumber(ecosystem.data.value.averageFeedback) }}.</template>
            </p>
            <p v-if="stats.signals.length">
              What gave this desk pause: <template v-for="(s, i) in stats.signals" :key="s.code"><i :class="{ red: s.level === 'high' }">{{ s.text }}</i>{{ i < stats.signals.length - 1 ? '; ' : '.' }}</template>
            </p>
            <p v-else>Nothing in the reviews raised a flag.</p>
          </div>
          <blockquote v-for="q in quotes" :key="`${q.client}${q.index}`" class="l-quote">
            <FeedbackNote :uri="q.feedbackURI!" />
            <cite>— reviewer {{ shortAddress(q.client) }}, rating {{ formatScore(q.value) }}</cite>
          </blockquote>

          <p class="l-kicker">The full record</p>
          <p v-if="agent.feedbackSince" class="muted" style="font-size: 13px">Dated back to {{ formatDate(agent.feedbackSince) }} (log scan window). Click a row for its paper trail.</p>
          <div class="l-scroll">
            <table class="l-table">
              <thead><tr><th>Reviewer</th><th class="num">Rating</th><th class="num">Counts as</th><th>Notes</th><th>Tags</th><th>When</th></tr></thead>
              <tbody>
                <template v-for="(row, i) in agent.feedback" :key="i">
                  <tr :class="{ revoked: row.revoked }" style="cursor: pointer" @click="open = open === i ? undefined : i">
                    <td><RouterLink :to="to.reviewer(row.client)" class="l-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink></td>
                    <td class="num"><b>{{ formatScore(row.value) }}</b></td>
                    <td class="num">{{ formatNumber(stats.rows[i]?.weight, 2) }}</td>
                    <td class="muted" style="font-size: 13px">{{ flags(stats.rows[i]?.flags ?? []) }}{{ row.responses?.length ? ` · ${row.responses.length} replies` : '' }}</td>
                    <td class="muted" style="font-size: 13px">{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') }}</td>
                    <td style="font-size: 13px">
                      <a v-if="row.txHash && row.createdAt" :href="txExplorerUrl(chain, row.txHash)" target="_blank" rel="noopener noreferrer" @click.stop>{{ formatTimeline(row.createdAt) }}</a>
                      <template v-else>{{ row.createdAt ? formatTimeline(row.createdAt) : '—' }}</template>
                    </td>
                  </tr>
                  <tr v-if="open === i"><td colspan="6"><TxPanel :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" /></td></tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>
        <p v-else class="l-deck">No one has reviewed this agent yet.</p>
      </article>

      <aside>
        <p class="l-kicker">By the numbers</p>
        <div v-if="report && stats" class="l-figs" style="grid-template-columns: 1fr 1fr">
          <div><b>{{ formatNumber(report.trusted) }}</b><small>trusted score</small></div>
          <div><b>{{ formatNumber(report.raw) }}</b><small>raw on-chain</small></div>
          <div><b>{{ report.strength.tier }}</b><small>evidence</small></div>
          <div><b :class="{ red: stats.level === 'high' }">{{ stats.level }}</b><small>risk</small></div>
          <div><b>{{ scan.data.value ? formatNumber(scan.data.value.total) : '—' }}</b><small>8004scan</small></div>
          <div><b>{{ formatPercent(scores?.trustMass) }}</b><small>votes that count</small></div>
        </div>
        <figure v-if="trend.path" style="margin: 0 0 16px">
          <svg class="l-chart" viewBox="0 0 300 64" role="img" aria-label="Running average">
            <line x1="0" x2="300" y1="30" y2="30" stroke="#cbc3b2" stroke-dasharray="2 3" />
            <path :d="trend.path" fill="none" stroke="#a3241b" stroke-width="2" />
          </svg>
          <figcaption class="muted" style="font-size: 12px">Running average, {{ trend.from ? formatDate(trend.from) : '' }} – {{ trend.to ? formatDate(trend.to) : '' }}. Dashed: 50.</figcaption>
        </figure>
        <p class="l-kicker">How the score was cut</p>
        <table v-if="report" class="l-table">
          <tbody>
            <tr v-for="s in report.waterfall" :key="s.id" :title="s.rule">
              <td>{{ s.label }}</td><td class="num">{{ formatNumber(s.average) }}</td><td class="num muted">{{ s.id === 'all' ? '' : formatSigned(s.delta) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="l-kicker">Loudest voices</p>
        <ol v-if="stats" style="padding-left: 20px; font-size: 14px">
          <li v-for="r in stats.reviewers.slice(0, 8)" :key="r.client">
            <RouterLink :to="to.reviewer(r.client)" class="l-mono">{{ shortAddress(r.client) }}</RouterLink>
            — {{ formatPercent(r.share) }} of the say, avg {{ formatNumber(r.average) }}
          </li>
        </ol>
        <p class="l-kicker">Particulars</p>
        <p style="font-size: 14px">
          Agent wallet:
          <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="l-mono">{{ shortAddress(agent.agentWallet) }}</a>
          <template v-else>not set</template><template v-if="walletIsOwner"> (the owner's)</template>.
          Registration file: <a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">on record</a><template v-else>{{ agent.agentURI ? 'inline' : 'none' }}</template>.
        </p>
        <p v-if="file?.services?.length" style="font-size: 14px">
          Services:
          <template v-for="(s, i) in file.services" :key="s.name + s.endpoint">{{ s.name }}<span class="muted"> ({{ s.endpoint }})</span>{{ i < file.services.length - 1 ? '; ' : '.' }}</template>
        </p>
        <details v-if="rawJson"><summary>The filing, verbatim</summary><pre>{{ rawJson }}</pre></details>
      </aside>
    </div>
  </template>
</template>
