<script setup lang="ts">
import { ref } from 'vue'
import { addressExplorerUrl } from '../../chains'
import type { AgentSummary } from '../../data/types'
import { formatScore, shortAddress } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import AgentPane from './AgentPane.vue'
import List from './List.vue'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const picked = ref<string>()
</script>

<template>
  <div class="i-split">
    <section class="i-list">
      <header>
        <h2><span class="mono">{{ address ? shortAddress(address) : 'Owner' }}</span><span class="soft">{{ data?.total ?? '' }}</span></h2>
        <a v-if="address" :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="soft mono" style="word-break: break-all">{{ address }} ↗</a>
      </header>
      <p v-if="!address" class="i-notice">“{{ props.address }}” is not a 0x address.</p>
      <p v-else-if="error" class="i-notice">{{ error }}</p>
      <p v-else-if="loading || !data" class="soft" style="padding: 12px">Loading…</p>
      <p v-else-if="!data.items.length" class="soft" style="padding: 12px">{{ page > 0 ? 'No more agents.' : 'Owns no agents here.' }}</p>
      <List v-else :items="data.items" :key-of="(a: AgentSummary) => a.tokenId.toString()" :selected="picked" @select="(a) => (picked = a.tokenId.toString())">
        <template #default="{ item: a }">
          <Sigil :seed="`${a.chainId}:${a.tokenId}`" :image="files.get(a.tokenId)?.image" :size="30" />
          <div class="main"><b>{{ files.get(a.tokenId)?.name ?? `Agent #${a.tokenId}` }}</b><span class="soft">#{{ a.tokenId }} · {{ scores?.get(a.tokenId)?.count ?? '…' }} reviews</span></div>
          <span class="i-num">{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</span>
        </template>
        <template #after>
          <div v-if="page > 0 || data.hasMore" style="display: flex; justify-content: space-between; padding: 10px 12px">
            <RouterLink v-if="page > 0" :to="pageLink(page - 1)">← Newer</RouterLink><span v-else />
            <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older →</RouterLink>
          </div>
        </template>
      </List>
    </section>
    <section class="i-detail">
      <AgentPane v-if="picked" :key="picked" :chain="chain" :id="picked" />
      <div v-else class="i-empty"><div>Select one of its agents.</div></div>
    </section>
  </div>
</template>
