<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ALL_NETWORKS, CHAINS } from '../chains'
import { networkEnv } from '../env'
import SelectMenu, { type SelectOption } from './ui/SelectMenu.vue'

const props = withDefaults(
  defineProps<{ routeName: 'owners' | 'reviewers' | 'feedbacks' | 'network'; slug: string; allowAll?: boolean }>(),
  { allowAll: true },
)
const router = useRouter()

const options = computed<SelectOption[]>(() => [
  ...(props.allowAll ? [{ value: ALL_NETWORKS, label: 'All networks' }] : []),
  ...CHAINS.filter((c) => c.testnet === (networkEnv.value === 'testnet')).map((c) => ({
    value: c.slug,
    label: c.name,
    chainId: c.chainId,
  })),
])

function select(value: string | undefined): void {
  if (value && value !== props.slug) void router.push({ name: props.routeName, params: { slug: value } })
}
</script>

<template>
  <SelectMenu compact label="Network" :model-value="slug" :options="options" @update:model-value="select" />
</template>
