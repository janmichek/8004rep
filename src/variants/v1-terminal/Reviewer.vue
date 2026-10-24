<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../../format'
import { activeDays, asciiBar, evenness, velocity } from '../shared/metrics'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'
import Prompt from './Prompt.vue'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)

const extra = computed(() => {
  const items = feed.value?.items ?? []
  return {
    velocity: velocity(items.map((r) => r.createdAt)),
    days: activeDays(items.map((r) => r.createdAt)),
    evenness: evenness(profile.value?.perAgent.map((a) => a.rows) ?? []),
  }
})
const maxRows = computed(() => Math.max(1, ...(profile.value?.perAgent.map((a) => a.rows) ?? [])))
</script>

<template>
  <p><RouterLink :to="to.network()">cd ../network</RouterLink></p>
  <pre v-if="!address" class="t-err">error: "{{ props.address }}" is not a 0x address</pre>
  <template v-else>
    <Prompt :cmd="`finger ${address}`" :busy="wallet.loading.value">
      <dl class="t-kv">
        <dt>address</dt><dd><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">{{ address }} ↗</a></dd>
        <dt>account</dt>
        <dd>
          <template v-if="wallet.data.value">
            <span :class="wallet.data.value.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE ? 'amber' : ''">{{ wallet.data.value.nonce ?? '?' }} tx sent</span>
            <span class="dim"> · {{ wallet.data.value.kind ?? '?' }}</span>
          </template>
          <span v-else class="dim">…</span>
        </dd>
        <dt>funded by</dt>
        <dd>
          <template v-if="wallet.data.value?.funding">
            <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
            <span class="dim" v-if="wallet.data.value.funding.timestamp"> {{ formatDate(wallet.data.value.funding.timestamp) }}</span>
            <a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer"> tx↗</a>
          </template>
          <span v-else-if="!chain.explorerApiUrl" class="dim">untraceable on {{ chain.name }}</span>
          <span v-else-if="wallet.data.value?.fundingError" class="dim">lookup failed: {{ wallet.data.value.fundingError }}</span>
          <span v-else-if="wallet.data.value" class="dim">no incoming transfer among first txs</span>
          <span v-else class="dim">…</span>
        </dd>
      </dl>
    </Prompt>

    <Prompt :cmd="`profile --rows=${feed?.items.length ?? '…'}`" :busy="loading">
      <pre v-if="error" class="t-err">error: {{ error }} <button @click="load()">retry</button></pre>
      <pre v-else-if="!profile" class="dim">reading its feedback…</pre>
      <template v-else>
        <div class="t-cols">
          <pre><span class="dim">reviews        </span><b class="hi">{{ profile.rows }}</b> <span class="dim">{{ profile.revoked }} revoked</span>
<span class="dim">agents rated   </span>{{ profile.agents }}
<span class="dim">average given  </span>{{ formatNumber(profile.average) }}
<span class="dim">favourite val  </span>{{ profile.mode ? `${formatScore(profile.mode.value)} (${formatPercent(profile.mode.share)})` : '-' }}
<span class="dim">busiest 24h    </span>{{ profile.peakPerDay }}</pre>
          <pre><span class="dim">reviews/day    </span>{{ formatNumber(extra.velocity) }}
<span class="dim">active days    </span>{{ extra.days.days }} <span class="dim">(streak {{ extra.days.streak }})</span>
<span class="dim">spread         </span>{{ formatPercent(extra.evenness) }} <span class="dim">even across agents</span>
<span class="dim">first / last   </span>{{ profile.first ? formatDate(profile.first) : '-' }} → {{ profile.last ? formatDate(profile.last) : '-' }}</pre>
        </div>
        <pre v-for="l in profile.labels" :key="l"><span :class="LABEL_INFO[l].tone === 'warn' ? 'amber' : 'cyan'">[{{ LABEL_INFO[l].label }}]</span> {{ LABEL_INFO[l].rule }}</pre>
        <pre v-if="!profile.labels.length" class="ok">[clean] varied values, more than one agent, no bulk days</pre>
        <p><button v-if="feed?.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'loading…' : 'fetch --older' }}</button></p>
      </template>
    </Prompt>

    <template v-if="profile && feed">
      <Prompt cmd="ls agents --rated-by=me">
        <table class="t-table">
          <thead><tr><th>agent</th><th class="num">n</th><th></th><th class="num">avg</th><th class="num">revoked</th></tr></thead>
          <tbody>
            <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
              <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `agent-${a.tokenId}` }}</RouterLink> <span class="dim">#{{ a.tokenId }}</span></td>
              <td class="num">{{ a.rows }}</td>
              <td class="dim">{{ asciiBar(a.rows / maxRows, 14) }}</td>
              <td class="num">{{ formatNumber(a.average) }}</td>
              <td class="num">{{ a.revoked || '' }}</td>
            </tr>
          </tbody>
        </table>
      </Prompt>
      <Prompt cmd="history | head -50">
        <pre v-for="(r, i) in feed.items.slice(0, 50)" :key="i" :class="{ dim: r.revoked }"><span class="dim">{{ r.createdAt ? formatTimeline(r.createdAt).padStart(8) : '       -' }}</span> → <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `#${r.tokenId}` }}</RouterLink> <b class="hi">{{ formatScore(r.value) }}</b> <span class="dim">{{ [r.tag1, r.tag2].filter(Boolean).join(',') }}</span><a v-if="r.txHash" :href="txExplorerUrl(chain, r.txHash)" target="_blank" rel="noopener noreferrer"> tx↗</a></pre>
      </Prompt>
    </template>
  </template>
</template>
