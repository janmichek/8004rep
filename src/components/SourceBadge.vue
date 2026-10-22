<script setup lang="ts">
import { computed } from 'vue'
import type { ResolvedSource } from '../data'
import { formatDuration } from '../format'
import Hint from './ui/Hint.vue'
import Spinner from './ui/Spinner.vue'

const props = defineProps<{ resolved?: ResolvedSource }>()

/** Below this the subgraph counts as live. */
const LAG_SHOWN_SECONDS = 600

const lag = computed(() => {
  const seconds = props.resolved?.lagSeconds
  return seconds !== undefined && seconds > LAG_SHOWN_SECONDS ? formatDuration(seconds) : undefined
})
</script>

<template>
  <Spinner v-if="!resolved" label="Loading source" />
  <Hint v-else-if="resolved.source.kind === 'subgraph'" text="Agents are read from the chain's subgraph">
    <span class="badge ok" tabindex="0">
      subgraph<template v-if="lag"> · {{ lag }} behind</template>
    </span>
  </Hint>
  <Hint v-else :text="resolved.note ?? 'Agents are read directly from the registry contracts'">
    <span class="badge" :class="{ warn: resolved.note }" tabindex="0">
      rpc<template v-if="resolved.note"> · no subgraph</template>
    </span>
  </Hint>
</template>
