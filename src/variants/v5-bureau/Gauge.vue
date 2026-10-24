<script setup lang="ts">
import { computed } from 'vue'

// Semicircle gauge 0–100 with red / amber / green bands and a needle.
const props = defineProps<{ value: number | null }>()
const angle = computed(() => Math.PI * (1 - Math.max(0, Math.min(100, props.value ?? 0)) / 100))
function arc(from: number, to: number): string {
  const p = (v: number) => {
    const a = Math.PI * (1 - v / 100)
    return `${100 + 80 * Math.cos(a)},${100 - 80 * Math.sin(a)}`
  }
  return `M${p(from)} A80,80 0 0 1 ${p(to)}`
}
</script>

<template>
  <svg viewBox="0 0 200 116" style="width: 100%; max-width: 260px" role="img" :aria-label="`Score ${value ?? 'none'} of 100`">
    <path :d="arc(0, 40)" stroke="#b3261e" stroke-width="16" fill="none" />
    <path :d="arc(40.5, 70)" stroke="#c99a2e" stroke-width="16" fill="none" />
    <path :d="arc(70.5, 100)" stroke="#1f7a4a" stroke-width="16" fill="none" />
    <line v-if="value !== null" x1="100" y1="100" :x2="100 + 70 * Math.cos(angle)" :y2="100 - 70 * Math.sin(angle)" stroke="#18212b" stroke-width="3" stroke-linecap="round" />
    <circle cx="100" cy="100" r="6" fill="#18212b" />
    <text x="20" y="114" font-size="9" font-family="monospace" fill="#5d6873">0</text>
    <text x="172" y="114" font-size="9" font-family="monospace" fill="#5d6873">100</text>
  </svg>
</template>
