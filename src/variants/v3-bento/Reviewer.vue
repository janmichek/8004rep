<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { activeDays, evenness } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'
import Heat from './Heat.vue'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const days = computed(() => activeDays(feed.value?.items.map((r) => r.createdAt) ?? []))
const maxRows = computed(() => Math.max(1, ...(profile.value?.perAgent.map((a) => a.rows) ?? [])))
</script>

<template>
  <p v-if="!address" class="b-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <p v-if="error" class="b-notice">{{ error }} <button @click="load()">Retry</button></p>
    <div class="b-grid">
      <section class="b-card s6 b-row" style="gap: 16px">
        <Sigil :seed="address" :size="72" round />
        <div style="min-width: 0">
          <h3>Reviewer · <RouterLink :to="to.network()">{{ chain.name }}</RouterLink></h3>
          <p class="b-mono" style="word-break: break-all; margin: 0 0 6px">{{ address }}</p>
          <span v-for="l in profile?.labels ?? []" :key="l" class="b-pill" :class="LABEL_INFO[l].tone === 'warn' ? 'warn' : ''" :title="LABEL_INFO[l].rule">{{ LABEL_INFO[l].label }}</span>
          <span v-if="profile && !profile.labels.length" class="b-pill good">no rule fired</span>
          <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="b-pill">Explorer ↗</a>
        </div>
      </section>
      <section class="b-card s2"><h3>Reviews</h3><p class="b-big">{{ profile?.rows ?? '…' }}</p><p class="soft">{{ profile?.revoked ?? 0 }} revoked</p></section>
      <section class="b-card s2"><h3>Avg given</h3><p class="b-big">{{ formatNumber(profile?.average) }}</p><p class="soft">mode {{ profile?.mode ? formatScore(profile.mode.value) : '—' }}</p></section>
      <section class="b-card s2 b-dark">
        <h3>Wallet</h3>
        <p class="b-big" :class="{ warn: wallet.data.value?.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE }">{{ wallet.data.value?.nonce ?? '…' }}</p>
        <p class="soft">tx sent · {{ wallet.data.value?.kind ?? '' }}</p>
      </section>
      <template v-if="profile && feed">
        <section class="b-card s3"><h3>Active days</h3><p class="b-big">{{ days.days }}</p><p class="soft">longest streak {{ days.streak }}</p></section>
        <section class="b-card s3"><h3>Busiest 24h</h3><p class="b-big">{{ profile.peakPerDay }}</p></section>
        <section class="b-card s3"><h3>Spread</h3><p class="b-big">{{ formatPercent(evenness(profile.perAgent.map((a) => a.rows))) }}</p><p class="soft">evenness across agents</p></section>
        <section class="b-card s3 b-tint">
          <h3>Funding</h3>
          <template v-if="wallet.data.value?.funding">
            <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="b-mono">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
            <p class="soft" style="margin: 4px 0 0">{{ wallet.data.value.funding.timestamp ? formatDate(wallet.data.value.funding.timestamp) : '' }} · <a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">tx ↗</a></p>
          </template>
          <p v-else class="soft">{{ !chain.explorerApiUrl ? 'Not traceable here' : wallet.data.value?.fundingError ? 'Lookup failed' : wallet.data.value ? 'No incoming transfer found' : '…' }}</p>
        </section>
        <section class="b-card s6"><h3>When it reviews</h3><Heat :times="feed.items.map((r) => r.createdAt)" /></section>
        <section class="b-card s6">
          <h3>Agents it rated · {{ profile.agents }}</h3>
          <div v-for="a in profile.perAgent.slice(0, 10)" :key="a.tokenId.toString()" style="margin-bottom: 8px">
            <div class="b-row" style="justify-content: space-between; font-size: 13px">
              <RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent #${a.tokenId}` }}</RouterLink>
              <span><b>{{ a.rows }}</b> <span class="soft">· avg {{ formatNumber(a.average) }}</span></span>
            </div>
            <div class="b-meter"><i :style="{ width: `${(a.rows / maxRows) * 100}%` }" /></div>
          </div>
        </section>
        <section class="b-card s12">
          <h3>Latest reviews</h3>
          <div class="b-feed" style="max-height: 360px">
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="b-fb b-row" :class="{ revoked: r.revoked }" style="cursor: default">
              <span class="val">{{ formatScore(r.value) }}</span>
              <RouterLink :to="to.agent(r.tokenId)" style="flex: 1">{{ r.agentName ?? `Agent #${r.tokenId}` }}</RouterLink>
              <span v-if="r.tag1" class="b-pill">{{ r.tag1 }}</span>
              <span class="soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</span>
            </div>
          </div>
          <p style="text-align: center"><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Load older' }}</button></p>
        </section>
      </template>
    </div>
  </template>
</template>
