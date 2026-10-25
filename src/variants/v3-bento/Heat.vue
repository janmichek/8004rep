<script setup lang="ts">
import { computed } from 'vue'
import { weekHourGrid } from '../shared/metrics'

const props = defineProps<{ times: (number | undefined)[] }>()
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const grid = computed(() => weekHourGrid(props.times))
const max = computed(() => Math.max(1, ...grid.value.flat()))
const peak = computed(() => {
  let best = { d: 0, h: 0, n: 0 }
  grid.value.forEach((row, d) => row.forEach((n, h) => n > best.n && (best = { d, h, n })))
  return best
})
</script>

<template>
  <div class="b-heat" role="img" :aria-label="`Feedback by weekday and hour, UTC. Peak ${DAYS[peak.d]} ${peak.h}:00`">
    <template v-for="(row, d) in grid" :key="d">
      <b style="font-weight: 600">{{ DAYS[d] }}</b>
      <span v-for="(n, h) in row" :key="h" :title="`${DAYS[d]} ${h}:00 UTC · ${n}`" :style="{ background: n ? `rgba(109,93,252,${0.15 + 0.85 * (n / max)})` : '#f0f1f5' }" />
    </template>
  </div>
  <p class="soft" style="margin: 8px 0 0; font-size: 12px">UTC. Busiest slot {{ DAYS[peak.d] }} {{ peak.h }}:00 ({{ peak.n }}).</p>
</template>
