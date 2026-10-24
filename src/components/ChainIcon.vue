<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ chainId?: number; name?: string; size?: number }>(), { size: 16 })

type Mark = { color: string; glyph: 'arbitrum' | 'ethereum' | 'base' | 'mantle' | 'link' }

function hashName(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Known networks get their brand mark; everything else a tinted chain link. */
const mark = computed<Mark>(() => {
  const name = (props.name ?? '').toLowerCase()
  const id = props.chainId
  if (id === 42161 || id === 421614 || name.includes('arbitrum'))
    return { color: '#28a0f0', glyph: 'arbitrum' }
  if (id === 1 || id === 11155111 || name.includes('ethereum') || name.includes('sepolia'))
    return { color: '#627eea', glyph: 'ethereum' }
  if (id === 8453 || id === 84532 || name.includes('base')) return { color: '#0052ff', glyph: 'base' }
  if (id === 5000 || id === 5003 || name.includes('mantle')) return { color: '#0e9f6e', glyph: 'mantle' }
  const hue = ((id ?? hashName(name || 'chain')) * 47) % 360
  return { color: `hsl(${hue} 65% 52%)`, glyph: 'link' }
})

const box = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: mark.value.color,
}))
</script>

<template>
  <span class="chain-icon" :style="box" aria-hidden="true">
    <svg viewBox="0 0 16 16">
      <path v-if="mark.glyph === 'arbitrum'" d="M8 2.6 13.4 13H10.8L8 7.2 5.2 13H2.6Z" fill="#fff" />
      <path
        v-else-if="mark.glyph === 'ethereum'"
        d="M8 1.8 12.6 8 8 10.8 3.4 8Zm0 10.2 4.6-2.8L8 14.2 3.4 9.2Z"
        fill="#fff"
      />
      <path v-else-if="mark.glyph === 'base'" d="M4.2 6.8h7.6a1.2 1.2 0 0 1 0 2.4H4.2a1.2 1.2 0 0 1 0-2.4Z" fill="#fff" />
      <path v-else-if="mark.glyph === 'mantle'" d="M3.4 12.4V3.6l4.6 5.6 4.6-5.6v8.8h-2.3V7.7L8 10.7 5.7 7.7v4.7Z" fill="#fff" />
      <g v-else fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6">
        <path d="M6.2 9.8 9.8 6.2" />
        <path d="M7.4 5.2 8.6 4a2.4 2.4 0 0 1 3.4 3.4l-1.2 1.2" />
        <path d="M8.6 10.8 7.4 12a2.4 2.4 0 0 1-3.4-3.4l1.2-1.2" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.chain-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  vertical-align: middle;
}

.chain-icon svg {
  display: block;
  width: 76%;
  height: 76%;
}
</style>
