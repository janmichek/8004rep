<script setup lang="ts">
import { addressExplorerUrl } from '../../chains'
import { formatScore, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
</script>

<template>
  <main class="s-main">
    <header class="s-head"><h1>{{ address ? shortAddress(address) : 'Not an address' }}</h1><p v-if="data">{{ data.total ?? data.items.length }} agents</p></header>
    <p v-if="!address" class="s-empty">“{{ props.address }}” is not a 0x address.</p>
    <template v-else>
      <div class="s-cover" style="height: 110px; background: linear-gradient(120deg, #0f1419, #536471)" />
      <section class="s-profile">
        <span class="avatar"><Sigil :seed="address" :size="90" round /></span>
        <h2 class="mono" style="font-size: 15px; word-break: break-all">{{ address }}</h2>
        <p class="handle">Owner on {{ chain.name }} · <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer">explorer ↗</a></p>
      </section>
      <p v-if="error" class="s-empty">{{ error }}</p>
      <p v-else-if="loading || !data" class="s-empty">Loading…</p>
      <p v-else-if="!data.items.length" class="s-empty">{{ page > 0 ? 'No more agents.' : 'Owns no agents here.' }}</p>
      <template v-else>
        <article v-for="a in data.items" :key="a.tokenId.toString()" class="s-post">
          <Sigil :seed="`${a.chainId}:${a.tokenId}`" :image="files.get(a.tokenId)?.image" :size="44" round />
          <div class="body">
            <div class="who"><RouterLink :to="to.agent(a.tokenId)"><b>{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</b></RouterLink><span>@{{ a.tokenId }}</span></div>
            <p class="text" style="color: var(--ink)">{{ files.get(a.tokenId)?.description ?? '' }}</p>
            <div class="s-actions"><span>★ {{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</span><span>💬 {{ scores?.get(a.tokenId)?.count ?? '…' }}</span></div>
          </div>
        </article>
        <div v-if="page > 0 || data.hasMore" style="display: flex; justify-content: space-between; padding: 12px 16px">
          <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink><span v-else />
          <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink>
        </div>
      </template>
    </template>
  </main>
  <aside class="s-right" />
</template>
