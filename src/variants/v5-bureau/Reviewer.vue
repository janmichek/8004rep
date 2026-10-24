<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import { activeDays, evenness, velocity } from '../shared/metrics'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const times = computed(() => feed.value?.items.map((r) => r.createdAt) ?? [])
// Reliability: a source is "accredited" when no warn-level rule fires and the wallet is not fresh.
const accredited = computed(() => {
  const p = profile.value
  const nonce = wallet.data.value?.nonce
  if (!p) return undefined
  return !p.labels.some((l) => LABEL_INFO[l].tone === 'warn') && (nonce === undefined || nonce >= MIN_NONCE)
})
</script>

<template>
  <p class="mono"><RouterLink :to="to.network()">← Bulletin</RouterLink></p>
  <p v-if="!address" class="u-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <div v-if="accredited !== undefined" class="u-stamp" :class="{ ok: accredited }">{{ accredited ? 'Accredited source' : 'Source under review' }}</div>
    <section class="u-sec">
      <h2><span>§S</span> Reporting source audit</h2>
      <div class="u-fields">
        <div class="u-field" style="grid-column: span 2"><label>Source</label><div><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ address }}</a></div></div>
        <div class="u-field"><label>Account type</label><div>{{ wallet.data.value?.kind?.toUpperCase() ?? '…' }}</div></div>
        <div class="u-field"><label>Tx sent</label><div>{{ wallet.data.value?.nonce ?? '…' }}{{ wallet.data.value?.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE ? ' · FRESH' : '' }}</div></div>
        <div class="u-field" style="grid-column: span 2">
          <label>First funding</label>
          <div>
            <template v-if="wallet.data.value?.funding">
              <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
              {{ wallet.data.value.funding.timestamp ? formatDate(wallet.data.value.funding.timestamp) : '' }}
              <a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">tx ↗</a>
            </template>
            <template v-else>{{ !chain.explorerApiUrl ? 'NOT TRACEABLE' : wallet.data.value?.fundingError ? 'LOOKUP FAILED' : wallet.data.value ? 'NONE FOUND' : '…' }}</template>
          </div>
        </div>
      </div>
    </section>
    <p v-if="error" class="u-notice">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="soft mono">Auditing…</p>
    <template v-if="profile && feed">
      <section class="u-sec">
        <h2><span>§S.1</span> Reporting pattern</h2>
        <div class="u-fields">
          <div class="u-field"><label>Reports</label><div>{{ profile.rows }} ({{ profile.revoked }} withdrawn)</div></div>
          <div class="u-field"><label>Subjects</label><div>{{ profile.agents }}</div></div>
          <div class="u-field"><label>Mean value</label><div>{{ formatNumber(profile.average) }}</div></div>
          <div class="u-field"><label>Modal value</label><div>{{ profile.mode ? `${formatScore(profile.mode.value)} (${formatPercent(profile.mode.share)})` : '—' }}</div></div>
          <div class="u-field"><label>Peak 24h</label><div>{{ profile.peakPerDay }}</div></div>
          <div class="u-field"><label>Reports / day</label><div>{{ formatNumber(velocity(times)) }}</div></div>
          <div class="u-field"><label>Active days</label><div>{{ activeDays(times).days }}</div></div>
          <div class="u-field"><label>Subject evenness</label><div>{{ formatPercent(evenness(profile.perAgent.map((a) => a.rows))) }}</div></div>
        </div>
        <p v-for="l in profile.labels" :key="l" style="margin: 6px 0"><span class="u-mark" :class="LABEL_INFO[l].tone === 'warn' ? 'bad' : 'warn'">{{ LABEL_INFO[l].label }}</span>{{ LABEL_INFO[l].rule }}</p>
        <p v-if="!profile.labels.length" class="mono soft">NO EXCEPTIONS</p>
        <p><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Auditing…' : 'Extend audit window' }}</button></p>
      </section>
      <section class="u-sec">
        <h2><span>§S.2</span> Subjects reported</h2>
        <table class="u-table">
          <thead><tr><th>Subject</th><th class="num">Reports</th><th class="num">Avg</th><th class="num">Withdrawn</th></tr></thead>
          <tbody>
            <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
              <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `AGENT ${a.tokenId}` }}</RouterLink></td>
              <td class="num">{{ a.rows }}</td><td class="num">{{ formatNumber(a.average) }}</td><td class="num">{{ a.revoked || '' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section class="u-sec">
        <h2><span>§S.3</span> Latest reports</h2>
        <table class="u-table">
          <tbody>
            <tr v-for="(r, i) in feed.items.slice(0, 50)" :key="i" :class="{ revoked: r.revoked }">
              <td>{{ r.createdAt ? formatDate(r.createdAt) : '—' }}</td>
              <td><RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `AGENT ${r.tokenId}` }}</RouterLink></td>
              <td class="num"><b>{{ formatScore(r.value) }}</b></td>
              <td>{{ [r.tag1, r.tag2].filter(Boolean).join(' / ') }}</td>
              <td><a v-if="r.txHash" :href="txExplorerUrl(chain, r.txHash)" target="_blank" rel="noopener noreferrer">tx ↗</a></td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </template>
</template>
