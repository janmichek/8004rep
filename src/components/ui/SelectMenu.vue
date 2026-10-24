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
import { computed } from 'vue'
import ChainIcon from '../ChainIcon.vue'

export type SelectOption = { value: string; label: string; disabled?: boolean; chainId?: number }

const model = defineModel<string>()
const props = defineProps<{
  options: SelectOption[]
  /** Accessible name, since the trigger shows the current value rather than the field name. */
  label: string
  placeholder?: string
  compact?: boolean
}>()

const selected = computed(() => props.options.find((option) => option.value === model.value))

function pick(value: unknown): void {
  if (typeof value === 'string') model.value = value
}
</script>

<template>
  <SelectRoot :model-value="model" @update:model-value="pick">
    <SelectTrigger class="select-trigger" :class="{ compact }" :aria-label="label">
      <span class="select-value">
        <ChainIcon v-if="selected?.chainId !== undefined" :chain-id="selected.chainId" :name="selected.label" :size="15" />
        <SelectValue :placeholder="placeholder ?? label" />
      </span>
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
            <span class="select-option">
              <ChainIcon v-if="option.chainId !== undefined" :chain-id="option.chainId" :name="option.label" :size="15" />
              <SelectItemText>{{ option.label }}</SelectItemText>
            </span>
            <SelectItemIndicator class="select-check" aria-hidden="true">✓</SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
