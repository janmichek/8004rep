<script setup lang="ts">
import { computed } from 'vue'

// Circular jazzicon-style mark for wallets (owners, reviewers, funders).
// Distinct from AgentAvatar: circle + overlapping ellipses, warm palette, no letter.
const props = withDefaults(defineProps<{ address: string; size?: number }>(), { size: 16 })

/** Warm / earth tones — deliberately outside the agent teal–blue family. */
const PALETTE = ['#c45c26', '#b0892e', '#6b7c3a', '#3d6b6b', '#8b4a5c', '#5c4a3a', '#2f4a6b', '#a05a3c']

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const art = computed(() => {
  const seed = props.address.trim().toLowerCase()
  let state = hash(`addr:${seed}`) || 1
  const next = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return state >>> 0
  }
  const pick = () => PALETTE[next() % PALETTE.length]
  const bg = pick()
  const shapes = Array.from({ length: 3 }, (_, i) => {
    const angle = (next() % 360) * (Math.PI / 180)
    const dist = 4 + (next() % 12)
    return {
      key: i,
      fill: pick(),
      cx: 32 + Math.cos(angle) * dist,
      cy: 32 + Math.sin(angle) * dist,
      rx: 14 + (next() % 14),
      ry: 10 + (next() % 12),
      rot: next() % 360,
    }
  })
  return { bg, shapes }
})

const box = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
</script>

<template>
  <span class="addr-identicon" :style="box" aria-hidden="true">
    <svg viewBox="0 0 64 64">
      <rect width="64" height="64" :fill="art.bg" />
      <ellipse
        v-for="s in art.shapes"
        :key="s.key"
        :cx="s.cx"
        :cy="s.cy"
        :rx="s.rx"
        :ry="s.ry"
        :fill="s.fill"
        :transform="`rotate(${s.rot} ${s.cx} ${s.cy})`"
        opacity="0.92"
      />
    </svg>
  </span>
</template>
