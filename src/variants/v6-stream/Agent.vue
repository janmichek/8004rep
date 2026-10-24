<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatSigned, shortAddress } from '../../format'
import { byDay, letterGrade, velocity } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import Post from './Post.vue'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)

type Tab = 'reviews' | 'replies' | 'flagged' | 'about'
const tab = ref<Tab>('reviews')
const open = ref<number>()
const rows = computed(() => (agent.value?.feedback ?? []).map((row, index) => ({ row, index, createdAt: row.createdAt })))
const shown = computed(() => {
  if (tab.value === 'replies') return rows.value.filter((r) => r.row.responses?.length)
  if (tab.value === 'flagged') return rows.value.filter((r) => (stats.value?.rows[r.index]?.weight ?? 1) < 1)
  return rows.value
})
const days = computed(() => byDay([...shown.value].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))))
const replies = computed(() => rows.value.reduce((n, r) => n + (r.row.responses?.length ?? 0), 0))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
// Cover gradient seeded by the token id, so each profile looks its own.
const cover = computed(() => {
  const h = Number((agent.value?.tokenId ?? 0n) % 360n)
  return `linear-gradient(120deg, hsl(${h} 80% 60%), hsl(${(h + 60) % 360} 80% 55%))`
})
function badges(index: number) {
  const st = stats.value?.rows[index]
  if (!st) return []
  return [
    ...(st.weight < 1 && !st.flags.includes('revoked') ? [{ text: `counts ${formatNumber(st.weight, 2)}`, tone: 'warn' }] : []),
    ...st.flags.filter((f) => f !== 'revoked').map((f) => ({ text: FLAG_INFO[f].label, tone: 'warn' })),
  ]
}
</script>

<template>
  <main class="s-main">
    <header class="s-head">
      <h1><RouterLink :to="to.agents()" style="color: inherit">←</RouterLink> {{ file === undefined ? '…' : name }}</h1>
      <p v-if="agent">{{ agent.feedback.length }} reviews</p>
    </header>
    <p v-if="error" class="s-empty">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || agent === undefined" class="s-empty">Loading profile…</p>
    <p v-else-if="agent === null" class="s-empty">This account doesn't exist. No agent #{{ id }} on {{ chain.name }}.</p>
    <template v-else>
      <div class="s-cover" :style="{ background: cover }" />
      <section class="s-profile">
        <div style="display: flex; justify-content: space-between; align-items: flex-end">
          <span class="avatar"><Sigil :seed="`${chain.chainId}:${agent.tokenId}`" :image="file?.image" :size="100" round /></span>
          <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer"><button class="ghost">8004scan ↗</button></a>
        </div>
        <h2>{{ file === undefined ? '…' : name }} <span v-if="stats && agent.feedback.length" class="s-badge" :class="stats.level === 'high' ? 'bad' : stats.level === 'warn' ? 'warn' : 'ok'">{{ grade }}</span></h2>
        <p class="handle">@{{ agent.tokenId }} · {{ chain.name }}</p>
        <p style="margin: 8px 0">{{ file?.description ?? (file === null ? 'No bio: registration file unreachable.' : '') }}</p>
        <p class="soft" style="margin: 0; font-size: 14px">
          <span v-if="agent.createdAt">📅 Joined {{ formatDate(agent.createdAt) }} · </span>
          <RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">owned by {{ shortAddress(agent.owner) }}</RouterLink>
          <span v-if="file?.active === false"> · inactive</span>
        </p>
        <div class="s-counts">
          <span><b>{{ formatNumber(report?.trusted) }}</b> trusted</span>
          <span><b>{{ formatNumber(report?.raw) }}</b> raw</span>
          <span><b>{{ stats?.reviewers.length ?? 0 }}</b> reviewers</span>
          <span><b>{{ replies }}</b> replies</span>
          <span><b>{{ formatNumber(velocity(agent.feedback.map((f) => f.createdAt))) }}</b>/day</span>
        </div>
      </section>
      <nav class="s-tabs" role="tablist">
        <button v-for="t in (['reviews', 'replies', 'flagged', 'about'] as Tab[])" :key="t" :class="{ on: tab === t }" role="tab" :aria-selected="tab === t" @click="tab = t">{{ t[0].toUpperCase() + t.slice(1) }}</button>
      </nav>
      <section v-if="tab === 'about'" style="padding: 16px">
        <p style="margin: 0 0 6px"><b>Wallet</b> <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentWallet }}</a><span v-else class="soft">not set</span><span v-if="walletIsOwner" class="soft"> (owner)</span></p>
        <p style="margin: 0 0 6px"><b>Owner</b> <RouterLink v-if="agent.owner" :to="to.owner(agent.owner)" class="mono">{{ agent.owner }}</RouterLink></p>
        <p style="margin: 0 0 6px"><b>Profile file</b> <a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" class="mono">{{ agent.agentURI }}</a><span v-else class="soft mono">{{ agent.agentURI ?? 'not set' }}</span></p>
        <p style="margin: 0 0 6px"><b>Links</b> <span v-for="s in file?.services ?? []" :key="s.name + s.endpoint" class="s-badge" :title="s.endpoint">{{ s.name }}</span><span v-if="file?.x402Support" class="s-badge">x402</span><span v-for="t in file?.supportedTrust ?? []" :key="t" class="s-badge">{{ t }}</span></p>
        <pre v-if="rawJson">{{ rawJson }}</pre>
      </section>
      <template v-else>
        <p v-if="!shown.length" class="s-empty">{{ tab === 'reviews' ? 'No reviews yet.' : tab === 'replies' ? 'No review has a reply.' : 'Nothing counts less than a full vote.' }}</p>
        <template v-for="d in days" :key="d.day ?? 'none'">
          <div class="s-day">{{ d.day === null ? 'Undated' : formatDate(d.day) }}</div>
          <Post v-for="r in d.rows" :key="r.index" :row="r.row" :chain="chain" :author="to.reviewer(r.row.client)" :badges="badges(r.index)" @verify="open = open === r.index ? undefined : r.index">
            <TxPanel v-if="open === r.index && stats" :chain="chain" :agent="agent" :row="r.row" :index="r.index" :stats="stats" />
          </Post>
        </template>
      </template>
    </template>
  </main>
  <aside class="s-right">
    <div v-if="report && stats && agent?.feedback.length" class="s-box">
      <h2>Is this legit?</h2>
      <p style="margin: 0 0 8px; font-weight: 600">{{ report.headline }}</p>
      <p v-for="s in stats.signals" :key="s.code" style="margin: 0 0 6px; font-size: 14px"><span class="s-badge" :class="s.level === 'high' ? 'bad' : s.level === 'warn' ? 'warn' : ''">{{ s.level }}</span>{{ s.text }}</p>
      <p v-if="!stats.signals.length" class="soft">No warning signs.</p>
    </div>
    <div v-if="report && scores" class="s-box">
      <h2>Score story</h2>
      <p v-for="s in report.waterfall" :key="s.id" style="margin: 0 0 4px; font-size: 14px" :title="s.rule">{{ s.label }} <b>{{ formatNumber(s.average) }}</b> <span class="soft">{{ s.id === 'all' ? '' : formatSigned(s.delta) }}</span></p>
      <p class="soft" style="margin: 8px 0 0; font-size: 13px">8004scan {{ scan.data.value ? formatNumber(scan.data.value.total) : '—' }} · eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }} · momentum {{ formatSigned(scores.momentum) }}</p>
    </div>
    <div v-if="stats?.reviewers.length" class="s-box">
      <h2>Top fans</h2>
      <RouterLink v-for="r in stats.reviewers.slice(0, 6)" :key="r.client" :to="to.reviewer(r.client)" class="s-trend">
        <b class="mono">{{ shortAddress(r.client) }}</b><small>{{ r.rows }} reviews · avg {{ formatNumber(r.average) }} · {{ formatPercent(r.share) }} of the noise</small>
      </RouterLink>
    </div>
  </aside>
</template>
