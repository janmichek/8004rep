<script setup lang="ts">
import { computed } from 'vue'
import type { Address } from 'viem'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { activeDays, evenness } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import { routes, useReviewer } from '../shared/use'

const props = defineProps<{ chain: ChainInfo; address: Address }>()
const chain = computed(() => props.chain)
const addr = computed<Address | undefined>(() => props.address)
const to = routes(() => props.chain)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, addr)
const days = computed(() => activeDays(feed.value?.items.map((r) => r.createdAt) ?? []))
</script>

<template>
  <div class="inner">
    <div class="i-head">
      <Sigil :seed="address" :size="52" round />
      <div style="min-width: 0">
        <h1 class="mono" style="font-size: 14px; word-break: break-all">{{ address }}</h1>
        <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a>
        <span v-for="l in profile?.labels ?? []" :key="l" class="i-chip" :class="LABEL_INFO[l].tone === 'warn' ? 'warn' : ''" :title="LABEL_INFO[l].rule">{{ LABEL_INFO[l].label }}</span>
        <span v-if="profile && !profile.labels.length" class="i-chip ok">no rule fired</span>
      </div>
    </div>
    <p v-if="error" class="i-notice">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="soft">Loading its feedback…</p>
    <template v-if="profile && feed">
      <div class="i-kpis">
        <div><small>Reviews</small><b>{{ profile.rows }}</b></div>
        <div><small>Agents</small><b>{{ profile.agents }}</b></div>
        <div><small>Average</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Mode</small><b>{{ profile.mode ? formatScore(profile.mode.value) : '—' }}</b><small>{{ formatPercent(profile.mode?.share) }}</small></div>
        <div><small>Peak 24h</small><b>{{ profile.peakPerDay }}</b></div>
        <div><small>Active days</small><b>{{ days.days }}</b></div>
        <div><small>Evenness</small><b>{{ formatPercent(evenness(profile.perAgent.map((a) => a.rows))) }}</b></div>
        <div><small>Tx sent</small><b :style="{ color: wallet.data.value?.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE ? 'var(--warn)' : '' }">{{ wallet.data.value?.nonce ?? '…' }}</b><small>{{ wallet.data.value?.kind }}</small></div>
      </div>
      <p class="soft">
        <template v-if="wallet.data.value?.funding">
          First funded by <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
          <template v-if="wallet.data.value.funding.timestamp"> on {{ formatDate(wallet.data.value.funding.timestamp) }}</template>
          (<a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">tx</a>).
        </template>
        <template v-else-if="!chain.explorerApiUrl">Funding untraceable on {{ chain.name }}.</template>
        <template v-else-if="wallet.data.value?.fundingError">Funding lookup failed.</template>
      </p>
      <section class="i-sec">
        <h3>Agents it rated</h3>
        <div class="i-rows">
          <RouterLink v-for="a in profile.perAgent" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="i-row" style="color: inherit; text-decoration: none">
            <span>{{ a.agentName ?? `Agent #${a.tokenId}` }} <span class="soft">#{{ a.tokenId }}</span></span><span>{{ a.rows }}</span><b>{{ formatNumber(a.average) }}</b>
          </RouterLink>
        </div>
      </section>
      <section class="i-sec">
        <h3>Latest reviews · {{ feed.items.length }}<template v-if="feed.since"> since {{ formatDate(feed.since) }}</template></h3>
        <div class="i-rows">
          <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="i-row" :class="{ revoked: r.revoked }" style="cursor: default">
            <span><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `#${r.tokenId}` }}</RouterLink> <span v-if="r.tag1" class="i-chip">{{ r.tag1 }}</span></span>
            <b>{{ formatScore(r.value) }}</b><span class="soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
          </div>
        </div>
        <p><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older' }}</button></p>
      </section>
    </template>
  </div>
</template>
