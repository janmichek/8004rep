<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl } from '../../chains'
import { formatDate, formatNumber, formatScore } from '../../format'
import Sigil from '../shared/Sigil.vue'
import { routes, useAddress, useAgentList, useChain, useFiles, usePageQuery } from '../shared/use'
import { taxonOf } from './taxonomy'

const props = defineProps<{ slug: string; address: string }>()
const chain = useChain(() => props.slug)
const address = useAddress(() => props.address)
const to = routes(() => chain.value)
const { page, search, pageLink } = usePageQuery()
const { data, error, loading, reload, scores } = useAgentList(chain, page, search, address)
const files = useFiles(() => data.value?.items ?? undefined)
const cards = computed(() =>
  (data.value?.items ?? []).map((a) => {
    const f = files.value.get(a.tokenId)
    return { a, f, s: scores.value?.get(a.tokenId), taxon: taxonOf(f, `Agent ${a.tokenId}`) }
  }),
)
</script>

<template>
  <p v-if="!address" class="h-err">“{{ props.address }}” is not an address.</p>
  <template v-else>
    <p class="h-kicker">Collector</p>
    <h1 class="h-h1">The cabinet of {{ address.slice(0, 6) }}…{{ address.slice(-4) }}</h1>
    <p class="h-prose">
      <a :href="addressExplorerUrl(chain, address)" target="_blank" rel="noopener noreferrer" class="h-mono">{{ address }}</a>
      collected {{ data?.total ?? '…' }} specimen{{ data?.total === 1 ? '' : 's' }} in {{ chain.name }}.
    </p>
    <p v-if="error" class="h-err">{{ error }} <button @click="reload">Retry</button></p>
    <p v-else-if="loading || !data" class="h-empty">Opening the cabinet…</p>
    <p v-else-if="!data.items.length" class="h-empty">This collector has pressed nothing here.</p>
    <template v-else>
      <ul class="h-grid" style="margin-top: 18px">
        <li v-for="c in cards" :key="c.a.tokenId.toString()" class="h-card">
          <span class="h-pin" />
          <div class="h-specimen">
            <Sigil :seed="`${c.a.chainId}:${c.a.tokenId}`" :image="c.f?.image" :size="48" :palette="['#3f5d3a', '#7d8a4e', '#9a5b3f', '#b28b3c', '#2c4229']" />
            <div class="h-name">
              <RouterLink :to="to.agent(c.a.tokenId)">{{ c.f?.name ?? `Agent ${c.a.tokenId}` }}</RouterLink>
              <span class="h-taxon">{{ c.taxon.line }}</span>
            </div>
          </div>
          <dl class="h-label">
            <dt>Collection</dt><dd class="h-mono">#{{ c.a.tokenId }}</dd>
            <dt>Observed</dt><dd>{{ c.s?.count ?? '—' }}×</dd>
            <dt>Determination</dt><dd class="h-det">{{ c.s?.count ? formatScore(c.s.average) : 'n.d.' }}</dd>
            <dt>Pressed</dt><dd>{{ c.a.createdAt ? formatDate(c.a.createdAt) : 'undated' }}</dd>
          </dl>
        </li>
      </ul>
      <p class="h-empty">
        Mean determination across the rated sheets shown:
        {{ formatNumber(data.items.reduce((n, a) => n + (scores?.get(a.tokenId)?.average ?? 0), 0) / Math.max(1, data.items.filter((a) => scores?.get(a.tokenId)?.count).length)) }}.
      </p>
      <nav v-if="page > 0 || data.hasMore" class="h-pager">
        <RouterLink v-if="page > 0" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page - 1) }">← Earlier</RouterLink><span v-else />
        <RouterLink v-if="data.hasMore" :to="{ name: 'owner', params: { slug, address }, ...pageLink(page + 1) }">Later →</RouterLink><span v-else />
      </nav>
    </template>
  </template>
</template>
