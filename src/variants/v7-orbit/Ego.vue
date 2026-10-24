<script setup lang="ts">
import { computed } from 'vue'
import { ring } from '../shared/metrics'
import type { Satellite } from './orbit'

// One body at the centre, satellites around it. Distance from the centre = 1 − value/100:
// the kinder the rating, the closer the orbit.
const props = defineProps<{ center: string; centerColor?: string; satellites: Satellite[]; selected?: string }>()
const emit = defineEmits<{ pick: [id: string] }>()
const S = 500
const placed = computed(() => {
  const maxSize = Math.max(1, ...props.satellites.map((s) => s.size))
  return props.satellites.map((s, i) => {
    const r = 70 + (1 - Math.max(0, Math.min(100, s.value ?? 0)) / 100) * 160 + (i % 3) * 6
    const p = ring(i, props.satellites.length, r, S / 2, S / 2)
    return { ...s, ...p, r: 4 + 12 * Math.sqrt(s.size / maxSize) }
  })
})
</script>

<template>
  <svg class="o-sky" :viewBox="`0 0 ${S} ${S}`" role="img" :aria-label="`${center} and ${satellites.length} satellites`">
    <circle v-for="r in [70, 150, 230]" :key="r" :cx="S / 2" :cy="S / 2" :r="r" fill="none" stroke="#1c2140" stroke-dasharray="2 4" />
    <text :x="S / 2 + 72" :y="S / 2 - 4" style="fill: #7d84a8; font-size: 8px">100</text>
    <text :x="S / 2 + 232" :y="S / 2 - 4" style="fill: #7d84a8; font-size: 8px">0</text>
    <line v-for="p in placed" :key="`l${p.id}`" :x1="S / 2" :y1="S / 2" :x2="p.x" :y2="p.y" :stroke="p.color" :stroke-opacity="selected && selected !== p.id ? 0.05 : 0.25" />
    <circle :cx="S / 2" :cy="S / 2" r="26" :fill="centerColor ?? '#ffd166'" />
    <circle :cx="S / 2" :cy="S / 2" r="40" fill="none" :stroke="centerColor ?? '#ffd166'" stroke-opacity=".25" />
    <text :x="S / 2" :y="S / 2 + 56" text-anchor="middle" style="font-size: 12px; font-weight: 600">{{ center }}</text>
    <g v-for="p in placed" :key="p.id" class="node" :class="{ dim: selected && selected !== p.id }" tabindex="0" @click="emit('pick', p.id)" @keydown.enter="emit('pick', p.id)">
      <title>{{ p.title }}</title>
      <circle :cx="p.x" :cy="p.y" :r="p.r" :fill="p.color" fill-opacity=".85" />
      <circle v-if="selected === p.id" :cx="p.x" :cy="p.y" :r="p.r + 5" fill="none" stroke="#fff" />
      <text v-if="p.r > 9 || selected === p.id" :x="p.x" :y="p.y - p.r - 4" text-anchor="middle">{{ p.label }}</text>
    </g>
  </svg>
</template>
