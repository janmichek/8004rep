<script setup lang="ts">
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
</script>

<template>
  <p v-if="!address" class="d-error">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="d-kicker"><RouterLink :to="to.network()">Docket</RouterLink> / Witness statement</p>
    <h1 class="d-h1">Statement of {{ address.slice(0, 6) }}…{{ address.slice(-4) }}</h1>
    <p class="d-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="d-mono">{{ address }}</a></p>
    <p v-if="error" class="d-error">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="d-empty">Taking the statement…</p>
    <template v-else>
      <div class="d-figures">
        <div><small>Filings</small><b>{{ profile.rows }}</b></div>
        <div><small>Causes</small><b>{{ profile.agents }}</b></div>
        <div><small>Average value</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Peak in 24h</small><b>{{ profile.peakPerDay }}</b></div>
      </div>

      <div class="d-split">
        <div>
          <h2 class="d-h2">Cautions</h2>
          <p v-if="!profile.labels.length" class="d-motif">Nothing in the filing pattern calls for a caution.</p>
          <ul v-else class="d-paras">
            <li v-for="l in profile.labels" :key="l"><b class="d-flag">{{ LABEL_INFO[l].label }}</b> — {{ LABEL_INFO[l].rule }}</li>
          </ul>
          <p v-if="profile.mode" class="d-quote">
            The most frequent value is {{ formatScore(profile.mode.value) }}, {{ formatPercent(profile.mode.share) }} of the counting filings.
          </p>
          <h2 class="d-h2">Causes attested</h2>
          <table class="d-table">
            <thead><tr><th>Cause</th><th class="num">Filings</th><th class="num">Struck</th><th class="num">Average</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Agent ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num"><b>{{ formatNumber(a.average) }}</b></td>
              </tr>
            </tbody>
          </table>
          <h2 class="d-h2">Filings</h2>
          <div v-if="!feed" class="d-empty">…</div>
          <div v-else class="d-testimony">
            <div class="d-row head" style="grid-template-columns: 1fr 80px 90px; white-space: normal"><span>Cause</span><span class="v">Value</span><span class="v">Date</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 60)" :key="i" class="d-row" style="grid-template-columns: 1fr 80px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="v">{{ formatScore(r.value) }}</span>
              <span class="v soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
          </div>
          <nav class="d-pager"><span /><button v-if="feed?.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Reading…' : 'Earlier filings' }}</button><span /></nav>
        </div>
        <aside class="d-side">
          <h2 class="d-h2" style="margin-top: 0">Account</h2>
          <p v-if="wallet.data.value">
            {{ wallet.data.value.nonce ?? '?' }} transactions sent.
            {{ wallet.data.value.kind ? `Account type: ${wallet.data.value.kind}.` : '' }}
          </p>
          <p v-else class="d-motif">Account details unavailable.</p>
          <p v-if="wallet.data.value?.funding" class="d-motif">First funded by {{ wallet.data.value.funding.funder }} in {{ wallet.data.value.funding.txHash.slice(0, 10) }}…</p>
          <p v-if="profile.first" class="d-motif">First filing {{ formatDate(profile.first) }}<template v-if="profile.last">, last {{ formatDate(profile.last) }}</template>.</p>
        </aside>
      </div>
    </template>
  </template>
</template>
