<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { MIN_NONCE } from '../../data/txChecks'
import { formatDate, formatNumber, formatPercent, formatScore, shortAddress } from '../../format'
import { activeDays, byDay } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useChain, useReviewer } from '../shared/use'
import Post from './Post.vue'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const days = computed(() => byDay(feed.value?.items ?? []))
const active = computed(() => activeDays(feed.value?.items.map((r) => r.createdAt) ?? []))
</script>

<template>
  <main class="s-main">
    <header class="s-head"><h1><RouterLink :to="to.network()" style="color: inherit">←</RouterLink> {{ address ? shortAddress(address) : '…' }}</h1><p v-if="profile">{{ profile.rows }} posts</p></header>
    <p v-if="!address" class="s-empty">“{{ props.address }}” is not a 0x address.</p>
    <template v-else>
      <div class="s-cover" style="height: 110px; background: linear-gradient(120deg, #1d9bf0, #7856ff)" />
      <section class="s-profile">
        <span class="avatar"><Sigil :seed="address.toLowerCase()" :size="90" round :palette="['#1d9bf0', '#f91880', '#00ba7c', '#7856ff', '#ffad1f']" /></span>
        <h2 class="mono" style="font-size: 15px; word-break: break-all">{{ address }}</h2>
        <p class="handle">
          Reviewer on {{ chain.name }} · <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a>
          <template v-if="wallet.data.value"> · {{ wallet.data.value.nonce ?? '?' }} tx · {{ wallet.data.value.kind ?? '' }}<span v-if="wallet.data.value.nonce !== undefined && wallet.data.value.nonce < MIN_NONCE" class="s-badge warn">new account</span></template>
        </p>
        <p style="margin: 6px 0">
          <span v-for="l in profile?.labels ?? []" :key="l" class="s-badge" :class="LABEL_INFO[l].tone === 'warn' ? 'warn' : ''" :title="LABEL_INFO[l].rule">{{ LABEL_INFO[l].label }}</span>
          <span v-if="profile && !profile.labels.length" class="s-badge ok">regular account</span>
        </p>
        <p v-if="wallet.data.value?.funding" class="soft" style="margin: 0; font-size: 14px">
          💸 Funded by <a :href="addressExplorerUrl(chain, wallet.data.value.funding.funder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(wallet.data.value.funding.funder) }}</a>
          <template v-if="wallet.data.value.funding.timestamp"> on {{ formatDate(wallet.data.value.funding.timestamp) }}</template>
          · <a :href="txExplorerUrl(chain, wallet.data.value.funding.txHash)" target="_blank" rel="noopener noreferrer">tx</a>
        </p>
        <div v-if="profile" class="s-counts">
          <span><b>{{ profile.agents }}</b> following</span>
          <span><b>{{ formatNumber(profile.average) }}</b> avg given</span>
          <span><b>{{ profile.mode ? formatScore(profile.mode.value) : '—' }}</b> favourite ({{ formatPercent(profile.mode?.share) }})</span>
          <span><b>{{ active.days }}</b> active days</span>
          <span><b>{{ profile.peakPerDay }}</b> max/day</span>
        </div>
      </section>
      <p v-if="error" class="s-empty">{{ error }} <button @click="load()">Retry</button></p>
      <p v-else-if="!feed" class="s-empty">Loading posts…</p>
      <template v-else>
        <template v-for="d in days" :key="d.day ?? 'none'">
          <div class="s-day">{{ d.day === null ? 'Undated' : formatDate(d.day) }}</div>
          <Post v-for="(r, i) in d.rows" :key="i" :row="r" :chain="chain" :author="to.reviewer(r.client)" :subject="{ name: r.agentName ?? `#${r.tokenId}`, to: to.agent(r.tokenId) }" @verify="$router.push(to.agent(r.tokenId))" />
        </template>
        <button v-if="feed.cursor" class="s-more" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Show older posts' }}</button>
      </template>
    </template>
  </main>
  <aside class="s-right">
    <div v-if="profile" class="s-box">
      <h2>Follows</h2>
      <RouterLink v-for="a in profile.perAgent.slice(0, 10)" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="s-trend">
        <b>{{ a.agentName ?? `Agent #${a.tokenId}` }}</b><small>{{ a.rows }} posts · avg {{ formatNumber(a.average) }}</small>
      </RouterLink>
    </div>
  </aside>
</template>
