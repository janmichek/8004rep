<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { LABEL_INFO } from '../../data/reviewerProfile'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, formatTimeline } from '../../format'
import { routes, useAddress, useChain, useEcosystem, useReviewer } from '../shared/use'
import { starsOf } from './taste'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { feed, error, loading, load, profile, wallet } = useReviewer(chain, address)
const ecosystem = useEcosystem()
const stars = computed(() => starsOf(profile.value?.average))
const palate = computed(() => {
  const mine = profile.value?.average
  const all = ecosystem.data.value?.averageFeedback
  if (mine === null || mine === undefined || all === undefined) return null
  const gap = mine - all
  return gap > 5 ? 'generous' : gap < -5 ? 'severe' : 'even-handed'
})
const gap = computed(() => {
  const mine = profile.value?.average
  const all = ecosystem.data.value?.averageFeedback
  return mine === null || mine === undefined || all === undefined ? null : mine - all
})
</script>

<template>
  <p v-if="!address" class="r-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="r-kicker"><RouterLink :to="to.network()">Kitchen report</RouterLink> / critic</p>
    <h1 class="r-h1">The critic's card</h1>
    <p class="r-lede"><a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="r-mono">{{ address }}</a></p>
    <p v-if="error" class="r-err">{{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!profile" class="r-empty">Fetching the critic's notebook…</p>
    <template v-else>
      <div class="r-tiles">
        <div><small>Tastings</small><b>{{ profile.rows }}</b></div>
        <div><small>Dishes</small><b>{{ profile.agents }}</b></div>
        <div><small>Mean score</small><b>{{ formatNumber(profile.average) }}</b></div>
        <div><small>Palate</small><b style="font-size: 19px">{{ palate ?? '—' }}</b></div>
      </div>

      <div class="r-columns">
        <div>
          <h2 class="r-h2" style="margin-top: 0">Their marks</h2>
          <div class="r-hero" style="border-bottom-width: 1px">
            <div class="r-stars" style="font-size: 30px">
              <span v-for="(star, i) in stars" :key="i" :class="{ off: star === 'off' }">{{ star === 'off' ? '☆' : '★' }}</span>
            </div>
            <div class="r-prose" style="margin: 0; text-align: right; font-size: 13px">
              {{ formatSigned(gap) }} against the ecosystem mean
              <template v-if="profile.mode"><br />most often {{ formatScore(profile.mode.value) }} ({{ formatPercent(profile.mode.share) }})</template>
            </div>
          </div>

          <h2 class="r-h2">Habits worth noting</h2>
          <p v-if="!profile.labels.length" class="r-empty">Nothing in the notebook stands out.</p>
          <div v-for="l in profile.labels" :key="l" class="r-note" :class="{ 'r-warn': LABEL_INFO[l].tone === 'warn' }">
            <b>{{ LABEL_INFO[l].label }}.</b> {{ LABEL_INFO[l].rule }}
          </div>
          <p class="r-prose" style="font-size: 13px">
            The busiest day holds {{ profile.peakPerDay }} tasting{{ profile.peakPerDay === 1 ? '' : 's' }}<template v-if="profile.revoked">, and {{ profile.revoked }} were sent back</template>.
          </p>

          <h2 class="r-h2">Favourite dishes</h2>
          <table class="r-table">
            <thead><tr><th>Dish</th><th class="num">Tastings</th><th class="num">Sent back</th><th class="num">Mean</th></tr></thead>
            <tbody>
              <tr v-for="a in profile.perAgent" :key="a.tokenId.toString()">
                <td><RouterLink :to="to.agent(a.tokenId)">{{ a.agentName ?? `Dish ${a.tokenId}` }}</RouterLink></td>
                <td class="num">{{ a.rows }}</td>
                <td class="num">{{ a.revoked }}</td>
                <td class="num">{{ formatNumber(a.average) }}</td>
              </tr>
            </tbody>
          </table>

          <h2 class="r-h2">Notebook</h2>
          <div v-if="!feed" class="r-empty">…</div>
          <template v-else>
            <div class="r-tasting head" style="grid-template-columns: 1.5fr 70px 90px"><span>Dish</span><span class="num">Score</span><span class="num">When</span></div>
            <div v-for="(r, i) in feed.items.slice(0, 50)" :key="i" class="r-tasting" style="grid-template-columns: 1.5fr 70px 90px" :class="{ revoked: r.revoked }">
              <RouterLink :to="to.agent(r.tokenId)">{{ r.agentName ?? `Agent ${r.tokenId}` }}</RouterLink>
              <span class="num">{{ formatScore(r.value) }}</span>
              <span class="num soft">{{ r.createdAt ? formatTimeline(r.createdAt) : '—' }}</span>
            </div>
            <nav class="r-pager"><span /><button v-if="feed.cursor" :disabled="loading" @click="load(true)">{{ loading ? 'Turning pages…' : 'Earlier notes' }}</button><span /></nav>
          </template>
        </div>
        <aside class="r-side">
          <h2 class="r-h2" style="margin-top: 0">The critic</h2>
          <p v-if="wallet.data.value" class="r-prose" style="font-size: 13px">
            The account is a {{ wallet.data.value.kind ?? 'unknown' }} with {{ wallet.data.value.nonce ?? '?' }} transactions sent.
          </p>
          <p v-else class="r-empty">Account details unavailable.</p>
          <p v-if="profile.first" class="r-prose" style="font-size: 13px">
            First tasting {{ formatDate(profile.first) }}<template v-if="profile.last">; last {{ formatDate(profile.last) }}</template>.
          </p>
          <h2 class="r-h2">How to read the card</h2>
          <p class="r-prose" style="font-size: 13px">
            Stars are this critic's mean score, not an aggregate of their taste. A habit is a rule that fired; it is
            not a verdict about the critic.
          </p>
        </aside>
      </div>
    </template>
  </template>
</template>
