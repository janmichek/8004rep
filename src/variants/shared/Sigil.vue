<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toDisplayUrl } from '../../data/metadata'

// Seeded 5×5 mirrored identicon, or the agent's image when it loads.
// Colors come from `palette` so each design can tint it.
const props = withDefaults(defineProps<{ seed: string; image?: string; size?: number; palette?: string[]; round?: boolean }>(), {
  size: 32,
  palette: () => ['#0f9d8a', '#2b7fd9', '#4a63d9', '#17327a', '#0d4a6b'],
})

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const cells = computed(() => {
  let state = hash(props.seed) || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
  const colors = Array.from({ length: 2 + (state % 2) }, () => props.palette[next() % props.palette.length])
  const out: { key: number; x: number; y: number; fill: string }[] = []
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 3; col++) {
      const fill = colors[next() % colors.length]
      for (const x of col === 2 ? [col] : [col, 4 - col]) out.push({ key: row * 5 + x, x: x * 10, y: row * 10, fill })
    }
  return out
})

const src = computed(() => toDisplayUrl(props.image))
const broken = ref(false)
watch(src, () => (broken.value = false))
const box = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: props.round ? '50%' : `${Math.round(props.size / 5)}px`,
  overflow: 'hidden',
  display: 'inline-block',
  flex: 'none',
  verticalAlign: 'middle',
}))
</script>

<template>
  <span :style="box" class="sigil" aria-hidden="true">
    <img v-if="src && !broken" :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" style="width: 100%; height: 100%; object-fit: cover" @error="broken = true" />
    <svg v-else viewBox="0 0 50 50" style="width: 100%; height: 100%; display: block">
      <rect v-for="c in cells" :key="c.key" :x="c.x" :y="c.y" width="10" height="10" :fill="c.fill" />
    </svg>
  </span>
</template>
