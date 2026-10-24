<script setup lang="ts">
import { ref } from 'vue'
import { switchVariant, VARIANTS } from './registry'

// Styled inline: it has to look the same on top of every design's stylesheet.
const props = defineProps<{ current: number }>()
const open = ref(false)
const info = VARIANTS.find((v) => v.id === props.current)!

const BOX = 'position:fixed;right:14px;bottom:14px;z-index:9999;font:12px/1.4 system-ui,sans-serif;color:#eee'
const PILL =
  'all:unset;cursor:pointer;display:inline-flex;gap:6px;align-items:center;padding:7px 12px;border-radius:999px;background:#111;border:1px solid #444;box-shadow:0 4px 18px rgba(0,0,0,.35)'
const MENU =
  'position:absolute;right:0;bottom:40px;width:280px;max-height:70vh;overflow:auto;padding:6px;border-radius:12px;background:#111;border:1px solid #444;box-shadow:0 10px 30px rgba(0,0,0,.45)'
function item(active: boolean): string {
  return `all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;padding:7px 9px;border-radius:8px;${active ? 'background:#2a2a2a' : ''}`
}
</script>

<template>
  <div :style="BOX">
    <div v-if="open" :style="MENU" role="menu" aria-label="Designs">
      <button
        v-for="v in VARIANTS"
        :key="v.id"
        :style="item(v.id === current)"
        role="menuitemradio"
        :aria-checked="v.id === current"
        @click="v.id === current ? (open = false) : switchVariant(v.id)"
      >
        <b>{{ v.id }} · {{ v.name }}</b>
        <span style="display: block; color: #999">{{ v.idea }}</span>
      </button>
    </div>
    <button :style="PILL" :aria-expanded="open" title="Switch design" @click="open = !open">
      <span style="opacity: 0.6">design</span> <b>{{ info.id }} · {{ info.name }}</b> <span style="opacity: 0.6">{{ open ? '▾' : '▴' }}</span>
    </button>
  </div>
</template>
