<script setup lang="ts">
import { computed } from 'vue'
import type { ResolvedSource } from '../data'
import { formatDuration } from '../format'

const props = defineProps<{ resolved?: ResolvedSource }>()

/** Below this the subgraph counts as live. */
const LAG_SHOWN_SECONDS = 600

const lag = computed(() => {
  const seconds = props.resolved?.lagSeconds
  return seconds !== undefined && seconds > LAG_SHOWN_SECONDS ? formatDuration(seconds) : undefined
})
</script>

<template>
  <span v-if="!resolved" class="badge muted">checking source…</span>
  <span v-else-if="resolved.source.kind === 'subgraph'" class="badge ok" title="Agents are read from the chain's subgraph">
    subgraph<template v-if="lag"> · {{ lag }} behind</template>
  </span>
  <span v-else class="badge" :class="{ warn: resolved.note }" :title="resolved.note ?? 'Agents are read directly from the registry contracts'">
    rpc<template v-if="resolved.note"> · no subgraph</template>
  </span>
</template>
