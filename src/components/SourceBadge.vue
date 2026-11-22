<script setup lang="ts">
import { computed } from 'vue'
import type { ResolvedSource } from '../data'
import { formatDuration } from '../format'
import Hint from './ui/Hint.vue'
import Skeleton from './ui/Skeleton.vue'

const props = defineProps<{ resolved?: ResolvedSource; indexed?: boolean }>()

/** Below this the subgraph counts as live. */
const LAG_SHOWN_SECONDS = 600

const lag = computed(() => {
  const seconds = props.resolved?.lagSeconds
  return seconds !== undefined && seconds > LAG_SHOWN_SECONDS ? formatDuration(seconds) : undefined
})
</script>

<template>
  <Hint v-if="indexed" text="Agents, feedback and reports are served by the 8004rep indexer">
    <span class="badge ok" tabindex="0">indexed</span>
  </Hint>
  <Skeleton v-else-if="!resolved" width="7.5em" height="22px" radius="999px" />
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
