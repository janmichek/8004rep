<script setup lang="ts">
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

export type SelectOption = { value: string; label: string; disabled?: boolean }

const model = defineModel<string>()
defineProps<{
  options: SelectOption[]
  /** Accessible name, since the trigger shows the current value rather than the field name. */
  label: string
  placeholder?: string
  compact?: boolean
}>()

function pick(value: unknown): void {
  if (typeof value === 'string') model.value = value
}
</script>

<template>
  <SelectRoot :model-value="model" @update:model-value="pick">
    <SelectTrigger class="select-trigger" :class="{ compact }" :aria-label="label">
      <SelectValue :placeholder="placeholder ?? label" />
      <SelectIcon class="select-icon" aria-hidden="true">▾</SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="select-content" position="popper" :side-offset="4" :body-lock="false">
        <SelectViewport class="select-viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            class="select-item"
            :value="option.value"
            :disabled="option.disabled"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="select-check" aria-hidden="true">✓</SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
