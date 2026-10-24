<script setup lang="ts">
import { formatScore } from '../../format'

defineProps<{ value: number }>()
function color(v: number): string {
  return v >= 80 ? '#00ba7c' : v >= 50 ? '#ffad1f' : '#f91880'
}
</script>

<template>
  <span class="s-score" :style="{ background: color(value) }">{{ formatScore(value) }}</span>
</template>
