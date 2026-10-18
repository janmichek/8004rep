<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

export type Segment = { id: string; label: string; count?: number; disabled?: boolean }

const model = defineModel<string>({ required: true })
defineProps<{ segments: Segment[]; label: string }>()

/** Re-clicking the active item clears a single toggle group; a filter always keeps one choice. */
function pick(value: unknown): void {
  if (typeof value === 'string' && value) model.value = value
}
</script>

<template>
  <ToggleGroupRoot class="segmented" type="single" :model-value="model" :aria-label="label" @update:model-value="pick">
    <ToggleGroupItem v-for="segment in segments" :key="segment.id" class="segment" :value="segment.id" :disabled="segment.disabled">
      {{ segment.label }}
      <span v-if="segment.count !== undefined" class="muted">{{ segment.count }}</span>
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
