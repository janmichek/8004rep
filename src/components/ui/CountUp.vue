<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ value: string }>()

const shown = ref(props.value)
let frame = 0

// Splits "1,234 agents" into prefix, number and suffix so only the number counts up.
const NUMBER = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/

function run(target: string): void {
  cancelAnimationFrame(frame)
  const match = NUMBER.exec(target)
  if (!match || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown.value = target
    return
  }
  const [, before, digits, after] = match
  const end = Number(digits.replace(/,/g, ''))
  const decimals = digits.split('.')[1]?.length ?? 0
  const grouped = digits.includes(',')
  if (!Number.isFinite(end) || end === 0) {
    shown.value = target
    return
  }
  const started = performance.now()
  const step = (now: number): void => {
    const t = Math.min(1, (now - started) / 800)
    const eased = 1 - (1 - t) ** 4
    const text = (end * eased).toLocaleString('en-US', {
      useGrouping: grouped,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    shown.value = t < 1 ? `${before}${text}${after}` : target
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

watch(() => props.value, run, { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>{{ shown }}</template>
