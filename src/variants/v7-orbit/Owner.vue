<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatNumber, formatScore, shortAddress } from '../../format'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import Ego from './Ego.vue'
import { AGENT, FADED, type Satellite } from './orbit'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const sats = computed<Satellite[]>(() =>
  (data.value?.items ?? []).map((a) => {
    const s = scores.value?.get(a.tokenId)
    return { id: String(a.tokenId), label: files.value.get(a.tokenId)?.name ?? `#${a.tokenId}`, size: Math.max(1, s?.count ?? 0), value: s?.count ? s.average : 0, color: s?.count ? AGENT : FADED, title: `${files.value.get(a.tokenId)?.name ?? `#${a.tokenId}`} · ${s?.count ?? 0} reviews` }
  }),
)
const router = { open: (id: string) => to.agent(id) }
</script>

<template>
  <p v-if="!address" class="o-notice">“{{ props.address }}” is not a 0x address.</p>
  <template v-else>
    <h1 class="o-title">System of <span class="mono" style="font-size: 0.6em">{{ shortAddress(address) }}</span></h1>
    <p class="o-sub">{{ data?.total ?? '…' }} agents owned on {{ chain.name }} · <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a></p>
    <p v-if="error" class="o-notice">{{ error }}</p>
    <p v-else-if="loading || !data" class="soft">Charting…</p>
    <p v-else-if="!data.items.length" class="soft">{{ page > 0 ? 'No more bodies.' : 'An empty system.' }}</p>
    <div v-else class="o-stage">
      <Ego :center="shortAddress(address)" center-color="#7aa2ff" :satellites="sats" @pick="(id) => $router.push(router.open(id))" />
      <aside class="o-panel">
        <h3>Bodies</h3>
        <ul class="o-list">
          <li v-for="a in data.items" :key="a.tokenId.toString()">
            <RouterLink :to="to.agent(a.tokenId)">{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</RouterLink>
            <span class="soft">{{ scores?.get(a.tokenId)?.count ? `${formatScore(scores.get(a.tokenId)!.average)} · ${scores.get(a.tokenId)!.count}` : formatNumber(null) }}</span>
          </li>
        </ul>
        <p v-if="page > 0 || data.hasMore" style="display: flex; justify-content: space-between; margin: 10px 0 0">
          <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink><span v-else />
          <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink>
        </p>
      </aside>
    </div>
  </template>
</template>
