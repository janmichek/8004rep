<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline, shortAddress } from '../../format'
import { activeDays } from '../shared/metrics'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { record, resultOf } from './league'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const ecosystem = useEcosystem()
// Leniency: how much kinder (or harsher) than the ecosystem's typical rating.
const leniency = computed(() => (profile.value?.average != null && ecosystem.data.value ? profile.value.average - ecosystem.data.value.averageFeedback : null))
const wdl = computed(() => record(feed.value?.items ?? []))
const days = computed(() => activeDays(feed.value?.items.map((r) => r.createdAt) ?? []))
</script>

<template>
  <p><RouterLink :to="to.network()" class="soft">← Season</RouterLink></p>
  <p v-if="!address" class="g-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <h1 class="g-title"><small>Referee report · {{ chain.name }}</small><span class="mono" style="font-size: 0.5em">{{ address }}</span></h1>
    <p><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="volt">Explorer ↗</a></p>
    <p v-if="error" class="g-notice">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="soft">Reviewing the tape…</p>
    <template v-if="profile && feed">
      <div class="g-stats">
        <div class="g-stat"><b>{{ profile.rows }}</b><small>Games</small></div>
        <div class="g-stat"><b>{{ wdl.W }}-{{ wdl.D }}-{{ wdl.L }}</b><small>W-D-L given</small></div>
        <div class="g-stat"><b :class="{ volt: Math.abs(leniency ?? 0) > 10 }">{{ formatSigned(leniency) }}</b><small>Leniency vs eco</small></div>
        <div class="g-stat"><b>{{ profile.agents }}</b><small>Players</small></div>
        <div class="g-stat"><b>{{ days.days }}</b><small>Matchdays</small></div>
        <div class="g-stat"><b>{{ profile.peakPerDay }}</b><small>Busiest day</small></div>
        <div class="g-stat"><b :class="{ volt: wallet.data.value?.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE }">{{ wallet.data.value?.nonce ?? '…' }}</b><small>Tx · {{ wallet.data.value?.kind ?? '' }}</small></div>
      </div>
      <div class="g-two">
        <section class="g-panel">
          <h3>Cards against this referee</h3>
          <p v-if="!profile.labels.length" class="soft">None: varied values, several players, no bulk days.</p>
          <p v-for="l in profile.labels" :key="l" style="margin: 6px 0"><span class="g-chip" :class="LABEL_INFO[l].tone === 'warn' ? 'red' : 'yellow'">{{ LABEL_INFO[l].label }}</span>{{ LABEL_INFO[l].rule }}</p>
          <p class="soft" style="margin-top: 10px">
            Favourite score {{ profile.mode ? `${formatScore(profile.mode.value)} (${formatPercent(profile.mode.share)})` : '–' }}.
            <template v-if="wallet.data.value?.funding">
              Funded by <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
              <template v-if="wallet.data.value.funding.timestamp"> on {{ formatDate(wallet.data.value.funding.timestamp) }}</template>
              (<a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">tx</a>).
            </template>
            <template v-else-if="!chain.explorerApiUrl">Funding untraceable on {{ chain.name }}.</template>
          </p>
        </section>
        <section class="g-panel">
          <h3>Players refereed</h3>
          <table class="g-table">
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent #${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td><td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      <section class="g-panel">
        <h3>Recent games</h3>
        <table class="g-table">
          <tbody>
            <tr v-for="(r, i) in feed.items.slice(0, 50)" :key="i" :class="{ revoked: r.revoked }">
              <td><span class="g-form"><i :class="resultOf(r)">{{ resultOf(r) }}</i></span></td>
              <td><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent #${r.tokenId}` }}</RouterLink></td>
              <td class="num g-pts" style="color: var(--ink)">{{ formatScore(r.value) }}</td>
              <td class="soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '' }}</td>
            </tr>
          </tbody>
        </table>
        <p style="text-align: center"><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Older games' }}</button></p>
      </section>
    </template>
  </template>
</template>
