<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { evenness } from '../shared/metrics'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'
import Ego from './Ego.vue'
import { AGENT, SUSPECT, type Satellite } from './orbit'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const sats = computed<Satellite[]>(() =>
  (profile.value?.perAgent ?? []).map((a) => ({ id: String(a.tokenId), label: a.agentName ?? `#${a.tokenId}`, size: a.rows, value: a.average, color: a.revoked ? SUSPECT : AGENT, title: `${a.agentName ?? `#${a.tokenId}`} · ${a.rows} reviews · avg ${formatNumber(a.average)}` })),
)
</script>

<template>
  <p v-if="!address" class="o-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <p class="soft"><RouterLink :to="to.network()">Constellation</RouterLink> / reviewer</p>
    <h1 class="o-title mono" style="font-size: clamp(16px, 2.4vw, 26px); word-break: break-all">{{ address }}</h1>
    <p class="o-sub">
      <span v-for="l in profile?.labels ?? []" :key="l" class="o-chip" :class="LABEL_INFO[l].tone === 'warn' ? 'sus' : ''" :title="LABEL_INFO[l].rule">{{ LABEL_INFO[l].label }}</span>
      <span v-if="profile && !profile.labels.length" class="o-chip ok">no rule fired</span>
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a>
    </p>
    <p v-if="error" class="o-notice">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="soft">Tracing its orbit…</p>
    <div v-if="profile && feed" class="o-stage">
      <div>
        <Ego :center="shortAddress(address)" center-color="#7aa2ff" :satellites="sats" @pick="(id) => $router.push(to.agent(id))" />
        <div class="o-legend"><span>agents it rates · closer = kinder average it gave · size = feedback</span></div>
      </div>
      <aside>
        <section class="o-panel">
          <h3>Trajectory</h3>
          <dl class="o-kv">
            <dt>Feedback</dt><dd>{{ profile.rows }} <span class="soft">({{ profile.revoked }} revoked)</span></dd>
            <dt>Agents</dt><dd>{{ profile.agents }}</dd>
            <dt>Average given</dt><dd>{{ formatNumber(profile.average) }}</dd>
            <dt>Favourite value</dt><dd>{{ profile.mode ? `${formatScore(profile.mode.value)} · ${formatPercent(profile.mode.share)}` : '—' }}</dd>
            <dt>Busiest 24h</dt><dd>{{ profile.peakPerDay }}</dd>
            <dt>Spread over agents</dt><dd>{{ formatPercent(evenness(profile.perAgent.map((a) => a.rows))) }}</dd>
            <dt>Wallet</dt><dd :style="{ color: wallet.data.value?.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE ? '#ff5d73' : '' }">{{ wallet.data.value ? `${wallet.data.value.nonce ?? '?'} tx · ${wallet.data.value.kind ?? '?'}` : '…' }}</dd>
            <dt>Funded by</dt>
            <dd>
              <template v-if="wallet.data.value?.funding">
                <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
                <a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer"> ↗</a>
              </template>
              <span v-else class="soft">{{ !chain.explorerApiUrl ? 'untraceable' : wallet.data.value ? 'not found' : '…' }}</span>
            </dd>
          </dl>
          <p style="margin: 10px 0 0"><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Tracing…' : 'Trace further back' }}</button></p>
        </section>
        <section class="o-panel">
          <h3>Emitted signals</h3>
          <ul class="o-list">
            <li v-for="(r, i) in feed.items.slice(0, 50)" :key="i" :style="{ opacity: r.revoked ? 0.4 : 1 }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `#${r.tokenId}` }}</RouterLink>
              <b>{{ formatScore(r.value) }}</b>
              <span class="soft" :title="r.createdAt ? formatDate(r.createdAt) : ''">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </template>
</template>
