<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { accessionOf, dimensionsOf, mediumOf, roomOf } from './museum'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, computed(() => ''), address)
const files = useFiles(() => data.value?.items)
const works = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    const s = scores.value?.get(a.tokenId)
    return { a, f, s, acc: accessionOf(a.tokenId), room: roomOf(s?.average) }
  }),
)
</script>

<template>
  <p v-if="!address" class="m-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="m-kicker">Lender</p>
    <h1 class="m-h1">Works on loan from one hand</h1>
    <p class="m-lede">
      {{ data?.total ?? '…' }} works in {{ chain.name }} are held by
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="m-mono">{{ address }}</a>.
    </p>
    <p v-if="error" class="m-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="m-empty">Checking the loan agreement…</p>
    <p v-else-if="!data.items.length" class="m-empty">This lender has no work in this wing.</p>
    <template v-else>
      <ul class="m-wall" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 30px 24px">
        <li v-for="w in works" :key="w.a.tokenId.toString()" class="m-work">
          <RouterLink :to="to.agent(w.a.tokenId)" class="m-frame" :class="w.room.id === 'I' ? 'room-1' : ''" style="padding: 13px">
            <Sigil :seed="w.a.tokenId.toString()" :image="w.f?.image" :size="150" :palette="['#9a7a3f', '#4c6349', '#9c3b32', '#22211e', '#7d786e']" />
          </RouterLink>
          <div class="m-label">
            <div class="acc">{{ w.acc }} · Room {{ w.room.id }}</div>
            <div class="title" style="font-size: 14px"><RouterLink :to="to.agent(w.a.tokenId)">{{ w.f?.name ?? `Untitled (Agent ${w.a.tokenId})` }}</RouterLink></div>
            <div class="meta">{{ mediumOf(w.f?.services) }}<br />{{ dimensionsOf(w.s?.count, w.s?.average) }}<br />{{ w.a.createdAt ? formatDate(w.a.createdAt) : 'undated' }}</div>
          </div>
        </li>
      </ul>
      <nav v-if="page > 0 || data.hasMore" class="m-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Earlier works</RouterLink><span v-else />
        <span class="soft">{{ formatNumber(data.items.length) }} on this wall</span>
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">More works →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
