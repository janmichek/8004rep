<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

defineProps<{ text?: string }>()
</script>

<template>
  <TooltipRoot v-if="text" :delay-duration="200">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="hint" side="top" :side-offset="6">{{ text }}</TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
  <slot v-else />
</template>
