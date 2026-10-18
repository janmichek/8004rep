<script setup lang="ts">
import { computed } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useRoute, useRouter } from 'vue-router'

export type Tab = { id: string; label: string; count?: number; tone?: 'warn' | 'bad' }

// The open tab lives in `?tab=` so a link reopens the same view.
const props = defineProps<{ tabs: Tab[]; label: string }>()
const route = useRoute()
const router = useRouter()

const current = computed(() => {
  const asked = route.query.tab
  return props.tabs.find((t) => t.id === asked)?.id ?? props.tabs[0]?.id ?? ''
})

function select(id: string | number): void {
  const value = String(id)
  if (!props.tabs.some((tab) => tab.id === value)) return
  void router.replace({ query: { ...route.query, tab: value === props.tabs[0]?.id ? undefined : value } })
}
</script>

<template>
  <TabsRoot class="tabs" :model-value="current" @update:model-value="select">
    <TabsList class="tabbar" :aria-label="label">
      <TabsTrigger v-for="tab in tabs" :id="`tab-${tab.id}`" :key="tab.id" class="tab" :value="tab.id">
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="tab-count" :class="tab.tone">{{ tab.count }}</span>
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="tab in tabs" :key="tab.id" class="tabpanel" :value="tab.id">
      <slot :name="tab.id" />
    </TabsContent>
  </TabsRoot>
</template>
