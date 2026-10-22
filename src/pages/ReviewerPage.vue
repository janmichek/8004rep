<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { isAddress, type Address } from 'viem'
import { addressExplorerUrl, findChainBySlug, txExplorerUrl } from '../chains'
import StatTiles, { type Tile } from '../components/ui/StatTiles.vue'
import TilesSkeleton from '../components/ui/TilesSkeleton.vue'
import { sourceFor } from '../data'
import { loadFeedWindow, type FeedWindow } from '../data/feed'
import { buildReviewerProfile } from '../data/reviewerProfile'
import { MIN_NONCE } from '../data/txChecks'
import { errorMessage, formatDate, formatNumber, formatPercent, formatScore, formatTimeline, shortAddress } from '../format'
import FeedbackNote from '../components/FeedbackNote.vue'
import { useAsync } from '../useAsync'

const props = defineProps<{ slug: string; address: string }>()
const chain = computed(() => findChainBySlug(props.slug)!)
const address = computed(() => (isAddress(props.address, { strict: false }) ? (props.address as Address) : undefined))

// The feed grows with "Load older"; wallet facts load once.
const feed = shallowRef<FeedWindow>()
const feedError = shallowRef<string>()
const loadingFeed = shallowRef(false)

async function loadFeed(extend = false): Promise<void> {
  if (!address.value) return
  const target = { chain: chain.value, address: address.value }
  loadingFeed.value = true
  feedError.value = undefined
  try {
    const { source } = await sourceFor(target.chain)
    const next = await loadFeedWindow(source, { client: target.address }, { minRows: 100, ...(extend && feed.value ? { from: feed.value } : {}) })
    if (target.chain === chain.value && target.address === address.value) feed.value = next
  } catch (err) {
    feedError.value = errorMessage(err)
  } finally {
    loadingFeed.value = false
  }
}
watch(
  () => [chain.value, address.value],
  () => {
    feed.value = undefined
    void loadFeed()
  },
  { immediate: true },
)

const wallet = useAsync(
  async () => {
    if (!address.value) return null
    const { rpcClient } = await sourceFor(chain.value)
    const [nonce, code] = await Promise.allSettled([
      rpcClient.getTransactionCount({ address: address.value }),
      rpcClient.getCode({ address: address.value }),
    ])
    const bytecode = code.status === 'fulfilled' ? (code.value ?? '0x') : undefined
    return {
      nonce: nonce.status === 'fulfilled' ? nonce.value : undefined,
      kind: bytecode === undefined ? undefined : bytecode === '0x' ? 'wallet' : bytecode.toLowerCase().startsWith('0xef0100') ? 'wallet + 7702' : 'contract',
    }
  },
  () => [chain.value, address.value],
)

const profile = computed(() => (address.value && feed.value ? buildReviewerProfile(address.value, feed.value.items) : undefined))

const tiles = computed<Tile[]>(() => {
  const p = profile.value
  const w = wallet.data.value
  if (!p) return []
  return [
    { label: 'Reviews', value: String(p.rows), hint: p.revoked ? `${p.revoked} revoked` : 'none revoked', tone: 'main' },
    { label: 'Agents rated', value: String(p.agents), hint: p.perAgent[0] ? `most on #${p.perAgent[0].tokenId} (${p.perAgent[0].rows})` : '' },
    { label: 'Average given', value: formatNumber(p.average), hint: 'non-revoked reviews' },
    {
      label: 'Most common value',
      value: p.mode ? formatScore(p.mode.value) : '—',
      hint: p.mode ? `${formatPercent(p.mode.share)} of reviews` : '',
      tone: p.labels.includes('rubber-stamp') ? 'warn' : undefined,
    },
    { label: 'Busiest 24h', value: String(p.peakPerDay), hint: 'reviews in one day', tone: p.labels.includes('bulk') ? 'warn' : undefined },
    {
      label: 'Wallet',
      value: w?.nonce === undefined ? '—' : `${w.nonce} tx`,
      hint: w?.kind ?? '',
      title: `Transactions sent. Under ${MIN_NONCE} is a fresh wallet.`,
      tone: w?.nonce !== undefined && w.nonce < MIN_NONCE ? 'warn' : undefined,
      loading: wallet.loading.value,
    },
  ]
})
</script>

<template>
  <p class="crumbs">
    <RouterLink :to="{ name: 'network', params: { slug: chain.slug } }">← {{ chain.name }} network</RouterLink>
  </p>

  <section v-if="!address" class="state">
    <h1>Not an address</h1>
    <p class="muted">“{{ props.address }}” is not a 0x address.</p>
  </section>

  <template v-else>
    <div class="page-head">
      <h1>Reviewer <span class="mono">{{ shortAddress(address) }}</span></h1>
      <p class="meta">
        <span class="mono">{{ address }}</span>
        <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">Explorer ↗</a>
      </p>
    </div>

    <p v-if="feedError" class="notice">Could not load its feedback: {{ feedError }} <button @click="loadFeed()">Retry</button></p>
    <div v-else-if="!profile" aria-busy="true" aria-live="polite">
      <span class="sr-only">Loading its feedback</span>
      <TilesSkeleton :count="6" />
    </div>

    <template v-if="profile">
      <StatTiles :tiles="tiles" />

      <section class="panel">
        <h3>Latest Reviews</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Agent</th><th class="num">Value</th><th>Tags</th><th>Text</th><th>When</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in feed!.items.slice(0, 50)" :key="i" :class="{ revoked: r.revoked }">
                <td>
                  <RouterLink :to="{ name: 'agent', params: { slug: chain.slug, id: r.tokenId.toString() } }">
                    {{ r.agentName ?? `Agent #${r.tokenId}` }}
                  </RouterLink>
                </td>
                <td class="num"><b>{{ formatScore(r.value) }}</b> <span v-if="r.revoked" class="chip">revoked</span></td>
                <td class="tags">
                  <span v-if="r.tag1" class="chip clip-chip" :title="r.tag1">{{ r.tag1 }}</span>
                  <span v-if="r.tag2" class="chip clip-chip" :title="r.tag2">{{ r.tag2 }}</span>
                </td>
                <td class="text-cell">
                  <FeedbackNote v-if="r.feedbackURI" :uri="r.feedbackURI" />
                  <span v-else class="muted">—</span>
                </td>
                <td class="nowrap">
                  <template v-if="r.createdAt">
                    <a v-if="r.txHash" :href="txExplorerUrl(chain, r.txHash)" target="_blank" rel="noopener noreferrer" :title="formatDate(r.createdAt)">
                      {{ formatTimeline(r.createdAt) }}
                    </a>
                    <span v-else :title="formatDate(r.createdAt)">{{ formatTimeline(r.createdAt) }}</span>
                  </template>
                  <span v-else class="muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted note">
          Based on {{ profile.rows }} rows<template v-if="feed?.since"> since {{ formatDate(feed.since) }} (log scan window)</template>.
          <button v-if="feed?.cursor" :disabled="loadingFeed" @click="loadFeed(true)">{{ loadingFeed ? 'Loading…' : 'Load older' }}</button>
        </p>
      </section>
    </template>
  </template>
</template>
