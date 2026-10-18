<script setup lang="ts">
export type Tile = {
  label: string
  value: string
  hint?: string
  /** Rule or source behind the number, shown on hover. */
  title?: string
  tone?: 'main' | 'good' | 'warn' | 'bad' | 'quiet'
  /** Words rather than a number: set in smaller type. */
  word?: boolean
}

defineProps<{ tiles: Tile[] }>()
</script>

<template>
  <div class="tiles">
    <div v-for="tile in tiles" :key="tile.label" class="tile" :class="tile.tone && `tone-${tile.tone}`" :title="tile.title">
      <div class="tile-label">{{ tile.label }}</div>
      <div class="tile-value" :class="{ word: tile.word }">{{ tile.value }}</div>
      <div v-if="tile.hint" class="tile-hint">{{ tile.hint }}</div>
    </div>
  </div>
</template>
