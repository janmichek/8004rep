<script setup lang="ts">
import { addressExplorerUrl } from '../../chains'
import { formatScore } from '../../format'
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
  <p v-if="!address" class="w-sentence w-red">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="w-hero">{{ data?.total ?? '…' }}</p>
    <p class="w-sentence">agents owned by <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="mono" style="font-size: 0.6em">{{ address }}</a></p>
    <p v-if="error" class="w-red">{{ error }}</p>
    <template v-else-if="data && !loading">
      <div class="w-row head"><span>Agent</span><span class="r">ID</span><span class="r">Reviews</span><span class="r">Average</span><span /></div>
      <RouterLink v-for="a in data.items" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="w-row" style="border-bottom: 0">
        <b>{{ files.get(a.tokenId)?.name ?? `Agent ${a.tokenId}` }}</b>
        <span class="r">{{ a.tokenId }}</span>
        <span class="r">{{ scores?.get(a.tokenId)?.count ?? '·' }}</span>
        <span class="r"><b>{{ scores?.get(a.tokenId)?.count ? formatScore(scores.get(a.tokenId)!.average) : '—' }}</b></span>
        <span />
      </RouterLink>
      <nav v-if="page > 0 || data.hasMore" class="w-pager">
        <RouterLink v-if="page > 0" :to="pageLink(page - 1)">Newer</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="pageLink(page + 1)">Older</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
