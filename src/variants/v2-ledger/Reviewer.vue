<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { activeDays, evenness } from '../shared/metrics'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const days = computed(() => activeDays(feed.value?.items.map((r) => r.createdAt) ?? []))
const spread = computed(() => evenness(profile.value?.perAgent.map((a) => a.rows) ?? []))
const charge = computed(() => {
  const p = profile.value
  if (!p) return ''
  if (!p.labels.length) return 'An unremarkable witness'
  return `Witness accused of being a ${LABEL_INFO[p.labels[0]].label}`
})
</script>

<template>
  <p class="l-byline"><RouterLink :to="to.network()">← Front page</RouterLink></p>
  <p v-if="!address" class="l-notice">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="l-kicker">Witness profile · {{ chain.name }}</p>
    <h2 class="l-head">{{ charge || 'A reviewer' }}</h2>
    <p class="l-byline"><span class="l-mono">{{ address }}</span> · <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a></p>
    <p v-if="error" class="l-notice">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="l-deck">Interviewing the record…</p>
    <template v-if="profile && feed">
      <div class="l-grid">
        <article class="l-cols">
          <p>
            Over {{ days.days }} active day{{ days.days === 1 ? '' : 's' }}<template v-if="profile.first && profile.last"> between {{ formatDate(profile.first) }} and {{ formatDate(profile.last) }}</template>,
            this address left {{ profile.rows }} feedback on {{ profile.agents }} agent{{ profile.agents === 1 ? '' : 's' }}, averaging {{ formatNumber(profile.average) }}.
            <template v-if="profile.mode">Its favourite number is {{ formatScore(profile.mode.value) }}, given {{ formatPercent(profile.mode.share) }} of the time.</template>
            On its busiest day it wrote {{ profile.peakPerDay }}; its longest run lasted {{ days.streak }} day{{ days.streak === 1 ? '' : 's' }}.
            Its attention is {{ formatPercent(spread) }} evenly spread across the agents it rates.
          </p>
          <p v-for="l in profile.labels" :key="l"><b>{{ LABEL_INFO[l].label }}.</b> {{ LABEL_INFO[l].rule }}</p>
          <p>
            <template v-if="wallet.data.value">
              The account has sent {{ wallet.data.value.nonce ?? 'an unknown number of' }} transactions<span v-if="wallet.data.value.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE" class="red"> — a fresh wallet</span>
              and is a {{ wallet.data.value.kind ?? 'account of unknown kind' }}.
              <template v-if="wallet.data.value.funding">
                It was first funded by <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="l-mono">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
                <template v-if="wallet.data.value.funding.timestamp"> on {{ formatDate(wallet.data.value.funding.timestamp) }}</template>
                (<a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">receipt</a>).
              </template>
              <template v-else-if="!chain.explorerApiUrl">Its funding cannot be traced on {{ chain.name }}.</template>
              <template v-else-if="wallet.data.value.fundingError">The funding lookup failed.</template>
            </template>
            <template v-else>Its account is being checked.</template>
          </p>
        </article>
        <aside>
          <p class="l-kicker">Whom it rates</p>
          <table class="l-table">
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `No. ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}×</td><td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>
          <p><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Reading…' : 'Older testimony' }}</button></p>
        </aside>
      </div>
      <p class="l-kicker">Testimony, latest first</p>
      <table class="l-table">
        <tbody>
          <tr v-for="(r, i) in feed.items.slice(0, 50)" :key="i" :class="{ revoked: r.revoked }">
            <td>{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</td>
            <td><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `No. ${r.tokenId}` }}</RouterLink></td>
            <td class="num"><b>{{ formatScore(r.value) }}</b></td>
            <td class="muted">{{ [r.tag1, r.tag2].filter(Boolean).join(' / ') }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </template>
</template>
