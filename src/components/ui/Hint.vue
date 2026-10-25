<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { RouterLink } from 'vue-router'

defineProps<{
  text?: string
  /** About page metric id — shown as a “More in About” link under the tip. */
  about?: string
}>()
</script>

<template>
  <TooltipRoot v-if="text" :delay-duration="200">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="hint" side="top" :side-offset="6">
        <p class="hint-text">{{ text }}</p>
        <RouterLink v-if="about" class="hint-more" :to="{ name: 'about', hash: `#${about}` }">More in About</RouterLink>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
  <slot v-else />
</template>
