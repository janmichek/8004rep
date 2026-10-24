<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CHAINS, DEFAULT_CHAIN } from '../../chains'
import { sourceText, useChainSwitch, useRouteChain } from '../shared/use'

const { route, slug, chain, resolved } = useRouteChain()
const router = useRouter()
const switchTo = useChainSwitch()

// g a / g n jump between views, 1–9 switch network, / focuses the search.
let pendingG = false
function onKey(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || e.metaKey || e.ctrlKey || e.altKey) return
  const s = (chain.value ?? DEFAULT_CHAIN).slug
  if (pendingG) {
    pendingG = false
    if (e.key === 'a') void router.push({ name: 'agents', params: { slug: s } })
    if (e.key === 'n') void router.push({ name: 'network', params: { slug: s } })
    return
  }
  if (e.key === 'g') pendingG = true
  else if (e.key === '/') {
    const input = document.querySelector<HTMLInputElement>('input[data-search]')
    if (input) {
      e.preventDefault()
      input.focus()
    }
  } else if (/^[1-9]$/.test(e.key) && CHAINS[Number(e.key) - 1]) switchTo(CHAINS[Number(e.key) - 1].slug)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="t-bar">
    <b>8004rep</b>
    <span>
      <RouterLink :to="{ name: 'agents', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'agents' }">[a]gents</RouterLink>
      ·
      <RouterLink :to="{ name: 'network', params: { slug: (chain ?? DEFAULT_CHAIN).slug } }" :class="{ on: route.name === 'network' }">[n]etwork</RouterLink>
    </span>
    <span>
      <template v-for="(c, i) in CHAINS" :key="c.slug">
        <button class="t-chain" :class="{ on: c.slug === chain?.slug }" style="border: 0; padding: 0 4px" @click="switchTo(c.slug)">{{ i + 1 }}:{{ c.slug }}</button>
      </template>
    </span>
    <span v-if="chain" :title="sourceText(resolved)?.detail" :class="sourceText(resolved)?.ok ? 'ok' : 'amber'">
      src={{ sourceText(resolved)?.label ?? '…' }}
    </span>
    <span class="t-keys"><kbd>g a</kbd> agents <kbd>g n</kbd> network <kbd>1-{{ CHAINS.length }}</kbd> chain <kbd>/</kbd> search <kbd>j k ⏎</kbd> rows</span>
  </div>
  <main class="t-wrap">
    <template v-if="slug && !chain">
      <p class="t-prompt done">$ use <b>{{ slug }}</b></p>
      <pre class="t-err">error: unknown network "{{ slug }}"</pre>
      <pre class="dim">available:</pre>
      <pre v-for="c in CHAINS" :key="c.slug">  <RouterLink :to="{ name: 'agents', params: { slug: c.slug } }">{{ c.slug }}</RouterLink>  {{ c.name }}</pre>
    </template>
    <RouterView v-else :key="route.path" />
    <p class="dim" style="margin-top: 40px">-- read-only · no wallet · data from the ERC-8004 registries and public subgraphs --</p>
  </main>
</template>
