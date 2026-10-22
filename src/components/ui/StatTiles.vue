<script setup lang="ts">
import Hint from './Hint.vue'
import Spinner from './Spinner.vue'

export type Tile = {
  label: string
  value: string
  hint?: string
  /** Rule or source behind the number, shown on hover. */
  title?: string
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
    <Hint v-for="tile in tiles" :key="tile.label" :text="tile.title">
      <div class="tile" :class="tile.tone && `tone-${tile.tone}`" :tabindex="tile.title ? 0 : undefined">
        <div class="tile-label">{{ tile.label }}</div>
        <div class="tile-value" :class="{ word: tile.word && !tile.loading }">
          <Spinner v-if="tile.loading" />
          <template v-else>{{ tile.value }}</template>
        </div>
        <div v-if="tile.loading" class="tile-hint">&nbsp;</div>
        <div v-else-if="tile.hint" class="tile-hint">{{ tile.hint }}</div>
      </div>
    </Hint>
  </div>
</template>
