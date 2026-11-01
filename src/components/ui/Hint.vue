<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { RouterLink } from 'vue-router'

defineProps<{
  text?: string
  /** About page section id to land on. Without it the link opens the About page top. */
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
        <RouterLink class="hint-more" :to="about ? { name: 'about', hash: `#${about}` } : { name: 'about' }">More</RouterLink>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
  <slot v-else />
</template>
