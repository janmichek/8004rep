<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toDisplayUrl } from '../data/metadata'

const props = defineProps<{ image?: string; label: string; pending?: boolean; seed?: string }>()

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

type Cell = { key: number; x: number; y: number; fill: string }

/** Matrix cell colors: brand teal/blue family, all dark enough for a white letter. */
const CELLS = ['#0f9d8a', '#0d8f9c', '#2b7fd9', '#3d6fdb', '#4a63d9', '#17327a', '#0d4a6b', '#12295f']

/** 5x5 mirrored matrix, every cell filled with a seeded brand color. */
const cells = computed<Cell[]>(() => {
  let state = hash(`${props.seed ?? props.label}#matrix`) || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
  // Two or three colors per avatar keep each one recognisable at 32px.
  const palette = Array.from({ length: 2 + (state % 2) }, () => CELLS[next() % CELLS.length])
  const out: Cell[] = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const fill = palette[next() % palette.length]
      for (const x of col === 2 ? [col] : [col, 4 - col]) out.push({ key: row * 5 + x, x: x * 10, y: row * 10, fill })
    }
  }
  return out
})

const src = computed(() => toDisplayUrl(props.image))
const broken = ref(false)
watch(src, () => (broken.value = false))
</script>

<template>
  <span v-if="pending" class="avatar skeleton" aria-hidden="true" />
  <span v-else class="avatar" :class="{ letter: !src || broken }">
    <img
      v-if="src && !broken"
      :src="src"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="broken = true"
    />
    <template v-else>
      <svg class="pattern" viewBox="0 0 50 50" aria-hidden="true">
        <rect v-for="c in cells" :key="c.key" :x="c.x" :y="c.y" width="10" height="10" :fill="c.fill" />
      </svg>
      <span class="glyph">{{ label.trim().charAt(0).toUpperCase() || '#' }}</span>
    </template>
  </span>
</template>
