<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { CHAINS, type ChainInfo } from '../chains'

defineProps<{ current?: ChainInfo }>()

const route = useRoute()
const router = useRouter()

// Token IDs and addresses are per chain. Network health has neither, so it stays.
function select(event: Event): void {
  const slug = (event.target as HTMLSelectElement).value
  const name = route.name === 'network' ? 'network' : 'agents'
  void router.push({ name, params: { slug } })
}
</script>

<template>
  <label class="chain-select">
    <span class="sr-only">Network</span>
    <select :value="current?.slug ?? ''" @change="select">
      <option v-if="!current" value="" disabled>Select network</option>
      <option v-for="chain in CHAINS" :key="chain.chainId" :value="chain.slug">{{ chain.name }}</option>
    </select>
  </label>
</template>
