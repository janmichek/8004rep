<script setup lang="ts">
import { computed } from 'vue'

// Gauge ring for a 0–100 value; `ghost` draws a second, thinner arc (e.g. raw vs trusted).
const props = withDefaults(defineProps<{ value: number | null; ghost?: number | null; size?: number; color?: string; label?: string }>(), {
  size: 120,
  color: '#6d5dfc',
})
const R = 42
const C = 2 * Math.PI * R
const dash = (v: number | null | undefined) => `${(Math.max(0, Math.min(100, v ?? 0)) / 100) * C} ${C}`
const text = computed(() => (props.value === null ? '—' : Number.isInteger(props.value) ? String(props.value) : props.value.toFixed(1)))
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 100 100" role="img" :aria-label="`${label ?? 'score'} ${text}`">
    <circle cx="50" cy="50" :r="R" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="9" />
    <circle v-if="ghost != null" cx="50" cy="50" :r="R" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="3" :stroke-dasharray="dash(ghost)" transform="rotate(-90 50 50)" />
    <circle cx="50" cy="50" :r="R" fill="none" :stroke="color" stroke-width="9" stroke-linecap="round" :stroke-dasharray="dash(value)" transform="rotate(-90 50 50)" />
    <text x="50" y="55" text-anchor="middle" font-size="22" font-weight="800" fill="currentColor">{{ text }}</text>
    <text v-if="label" x="50" y="70" text-anchor="middle" font-size="8" fill="currentColor" opacity=".6">{{ label }}</text>
  </svg>
</template>
