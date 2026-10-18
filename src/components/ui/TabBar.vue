<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type Tab = { id: string; label: string; count?: number; tone?: 'warn' | 'bad' }

// The open tab lives in `?tab=` so a link reopens the same view.
const props = defineProps<{ tabs: Tab[]; label: string }>()
const route = useRoute()
const router = useRouter()

const current = computed(() => {
  const asked = route.query.tab
  return props.tabs.find((t) => t.id === asked)?.id ?? props.tabs[0]?.id
})

function select(id: string): void {
  void router.replace({ query: { ...route.query, tab: id === props.tabs[0]?.id ? undefined : id } })
}

/** Arrow keys move between tabs, as the ARIA tabs pattern expects. */
function onKey(event: KeyboardEvent): void {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  const i = props.tabs.findIndex((t) => t.id === current.value)
  const next = props.tabs[(i + step + props.tabs.length) % props.tabs.length]
  select(next.id)
  void Promise.resolve().then(() => document.getElementById(`tab-${next.id}`)?.focus())
}
</script>

<template>
  <div class="tabbar" role="tablist" :aria-label="label" @keydown="onKey">
    <button
      v-for="tab in tabs"
      :id="`tab-${tab.id}`"
      :key="tab.id"
      role="tab"
      class="tab"
      :class="{ active: tab.id === current }"
      :aria-selected="tab.id === current"
      :tabindex="tab.id === current ? 0 : -1"
      @click="select(tab.id)"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined" class="tab-count" :class="tab.tone">{{ tab.count }}</span>
    </button>
  </div>
  <div role="tabpanel" class="tabpanel" :aria-labelledby="`tab-${current}`">
    <slot :name="current" />
  </div>
</template>
