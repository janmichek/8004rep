<script setup lang="ts" generic="T">
import { nextTick, ref, watch } from 'vue'

// Selectable list: click or ↑/↓ moves the selection; the parent shows it.
const props = defineProps<{ items: T[]; keyOf: (item: T) => string; selected?: string }>()
const emit = defineEmits<{ select: [item: T] }>()
const box = ref<HTMLElement>()
function move(step: number): void {
  if (!props.items.length) return
  const i = props.items.findIndex((x) => props.keyOf(x) === props.selected)
  const next = props.items[Math.max(0, Math.min(props.items.length - 1, (i < 0 ? -1 : i) + step))]
  emit('select', next)
}
watch(
  () => props.selected,
  () => void nextTick(() => box.value?.querySelector('.i-item.on')?.scrollIntoView({ block: 'nearest' })),
)
</script>

<template>
  <div ref="box" class="i-items" tabindex="0" role="listbox" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)">
    <div v-for="item in items" :key="keyOf(item)" class="i-item" :class="{ on: keyOf(item) === selected }" role="option" :aria-selected="keyOf(item) === selected" @click="emit('select', item)">
      <slot :item="item" />
    </div>
    <slot name="after" />
  </div>
</template>
