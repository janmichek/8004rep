<script setup lang="ts">
import Spinner from './Spinner.vue'

export type Tile = {
  label: string
  value: string
  hint?: string
  tone?: 'main' | 'good' | 'warn' | 'bad' | 'quiet'
  /** Words rather than a number: set in smaller type. */
  word?: boolean
  /** Value is still being fetched. */
  loading?: boolean
}

defineProps<{ tiles: Tile[] }>()
</script>

<template>
  <div class="tiles">
    <div
      v-for="tile in tiles"
      :key="tile.label"
      class="tile"
      :class="tile.tone && `tone-${tile.tone}`"
    >
      <div class="tile-label">{{ tile.label }}</div>
      <div class="tile-value" :class="{ word: tile.word && !tile.loading }">
        <Spinner v-if="tile.loading" />
        <template v-else>{{ tile.value }}</template>
      </div>
      <div v-if="tile.loading" class="tile-hint">&nbsp;</div>
      <div v-else-if="tile.hint" class="tile-hint">{{ tile.hint }}</div>
    </div>
  </div>
</template>
