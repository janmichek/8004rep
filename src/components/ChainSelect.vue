<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { CHAINS, type ChainInfo } from '../chains'
import SelectMenu from './ui/SelectMenu.vue'

defineProps<{ current?: ChainInfo }>()

const route = useRoute()
const router = useRouter()

const options = CHAINS.map((chain) => ({ value: chain.slug, label: chain.name }))

// Token IDs and addresses are per chain. Network health has neither, so it stays.
function select(slug: string | undefined): void {
  if (!slug) return
  const name = route.name === 'network' ? 'network' : 'agents'
  void router.push({ name, params: { slug } })
}
</script>

<template>
  <SelectMenu
    :model-value="current?.slug"
    :options="options"
    label="Network"
    placeholder="Select network"
    @update:model-value="select"
  />
</template>
