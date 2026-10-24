<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import type { RiskSignal } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { accessionOf, conditionOf, dimensionsOf, mediumOf, roomOf } from './museum'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
const acc = computed(() => accessionOf(props.id))
const room = computed(() => roomOf(report.value?.trusted))
const condition = computed(() => conditionOf(report.value?.trusted, stats.value?.signals.length ?? 0))
const tone = (s: RiskSignal) => (s.level === 'high' ? 'm-warn' : s.level === 'warn' ? 'tone-warn' : '')
const history = computed(() =>
  (agent.value?.feedback ?? [])
    .filter((f) => f.createdAt)
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
)
</script>

<template>
  <p v-if="error" class="m-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="m-empty">Bringing the work up from the store…</p>
  <template v-else-if="agent === null">
    <p class="m-kicker">Not in the collection</p>
    <h1 class="m-h1">Accession {{ acc }} is empty.</h1>
  </template>
  <template v-else>
    <p class="m-kicker"><RouterLink :to="to.agents()">Galleries</RouterLink> / {{ acc }} / {{ room.name }}</p>
    <div class="m-feature">
      <div>
        <div class="m-frame" :class="room.id === 'I' ? 'room-1' : ''">
          <Sigil :seed="agent.tokenId.toString()" :image="file?.image" :size="300" :palette="['#9a7a3f', '#4c6349', '#9c3b32', '#22211e', '#7d786e']" />
        </div>
        <p class="m-label" style="margin-top: 16px; border-top: 0">
          <span class="acc">{{ acc }}</span><br />
          <span class="meta" style="font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--m-soft)">
            {{ room.name }}<br />{{ formatNumber(report?.trusted) }} / 100 trusted mean
          </span>
        </p>
      </div>

      <div class="m-walltext">
        <span class="m-room">{{ room.name }}</span>
        <h1 style="margin-top: 10px">{{ name }}</h1>
        <p class="artist">
          Held by <RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ shortAddress(agent.owner) }}</RouterLink><span v-else>an unknown hand</span>
          <template v-if="agent.createdAt"> · {{ formatDate(agent.createdAt) }}</template>
        </p>
        <p class="body">{{ file?.description ?? 'No catalogue essay came with this work. The label records only what the chain holds.' }}</p>

        <dl class="m-spec">
          <dt>Accession</dt><dd>{{ acc }}</dd>
          <dt>Medium</dt><dd>{{ mediumOf(file?.services) }}</dd>
          <dt>Dimensions</dt><dd>{{ dimensionsOf(stats?.coverage.total, report?.trusted) }}</dd>
          <dt>Credit</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else>—</span></dd>
          <dt>Agent wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (same as credit)' : '' }}</dd>
          <dt>Supported trust</dt><dd>{{ file?.supportedTrust.join(', ') || 'none declared' }}</dd>
          <dt>Catalogue file</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline' : '—' }}</span></dd>
          <dt>Full votes</dt><dd>{{ formatNumber(scores?.effectiveCount) }}</dd>
          <dt>Lower bound</dt><dd>{{ formatNumber(report?.lcb) }}</dd>
        </dl>

        <div class="m-condition" :class="(stats?.signals.length ?? 0) > 0 ? 'warn' : 'ok'">
          <b>Condition: {{ condition.word }}</b><span>{{ condition.detail }}</span>
        </div>
        <ul v-if="stats?.signals.length" style="margin: 10px 0 0; padding-left: 18px; font-size: 13px">
          <li v-for="s in stats.signals" :key="s.code" :class="tone(s)"><b>{{ s.code }}</b> — {{ s.text }}</li>
        </ul>

        <h2 class="m-h2">Curator's note</h2>
        <p class="m-prose">{{ report?.headline ?? 'Nothing to interpret yet.' }}</p>
        <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="m-prose" style="font-size: 13px">· {{ reason }}</p>
        <table class="m-table">
          <thead><tr><th>Step in the treatment</th><th class="num">After</th><th class="num">Rows</th></tr></thead>
          <tbody>
            <tr v-for="step in report?.waterfall ?? []" :key="step.id">
              <td>{{ step.label }} <span class="soft" style="display: block; font-size: 11px">{{ step.rule }}</span></td>
              <td class="num">{{ step.average === null ? '—' : formatNumber(step.average) }}</td>
              <td class="num">{{ step.rows }}</td>
            </tr>
          </tbody>
        </table>

        <h2 class="m-h2">Exhibition history</h2>
        <p v-if="!history.length" class="m-empty">No dated entry.</p>
        <ul v-else class="m-list">
          <li v-for="(h, i) in history.slice(0, 12)" :key="i">
            <span>{{ formatDate(h.createdAt!) }} · shown with {{ formatScore(h.value) }}<template v-if="h.revoked"> (withdrawn)</template></span>
            <span class="soft"><RouterLink :to="to.reviewer(h.client)" class="m-mono">{{ shortAddress(h.client) }}</RouterLink></span>
          </li>
        </ul>

        <h2 class="m-h2">Visitor book</h2>
        <p v-if="!agent.feedback.length" class="m-empty">The book is blank.</p>
        <template v-else>
          <div class="m-entry head"><span class="idx">No.</span><span>Entry</span><span>Visitor</span><span class="num">Score</span><span class="num">Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="m-entry" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'a bare mark' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> ({{ FLAG_INFO[f].label }})</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" class="m-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </template>

        <p class="m-foot" style="border-top: 1px dashed var(--m-rule); margin-top: 24px">
          <span><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></span>
          <span>{{ formatPercent(scores?.trustMass) }} of recorded volume survives the treatment.</span>
          <details v-if="rawJson"><summary>Registration file</summary><pre>{{ rawJson }}</pre></details>
        </p>
      </div>
    </div>
  </template>
</template>
