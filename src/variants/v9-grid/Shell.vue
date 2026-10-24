<script setup lang="ts">
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const switchTo = useChainSwitch()
</script>

<template>
  <div class="x-app">
    <header class="x-menu">
      <RouterLink class="x-doc" :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" style="color: inherit; text-decoration: none">
        <i aria-hidden="true" />
        <span><b>8004rep.xlsx</b><small>{{ chain?.name ?? '—' }} · <span :title="sourceText(resolved)?.detail">{{ chain ? (sourceText(resolved)?.label ?? 'connecting…') : '' }}</span></small></span>
      </RouterLink>
      <nav>
        <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">Agents</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">Network</RouterLink>
      </nav>
      <span style="flex: 1" />
      <nav aria-label="Workbook"><button v-for="c in CHAINS" :key="c.slug" :class="{ on: c.slug === chain?.slug }" @click="switchTo(c.slug)">{{ c.shortName }}</button></nav>
    </header>
    <main class="x-body">
      <template v-if="slug && !chain">
        <p class="x-note">#REF! — no workbook “{{ slug }}”.</p>
        <p><template v-for="c in CHAINS" :key="c.slug"><RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.name }}</RouterLink> · </template></p>
      </template>
      <RouterView v-else :key="route.path" />
    </main>
  </div>
</template>
