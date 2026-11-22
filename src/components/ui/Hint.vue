<script setup lang="ts">
import { computed } from 'vue'
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
import { RouterLink } from 'vue-router'
import { docsAnchor } from '../../data/docsLinks'

const props = defineProps<{
  text?: string
  /** Docs page section id to land on. Without it the link opens the Docs page top. */
  docs?: string
}>()

const docsTo = computed(() => {
  const id = docsAnchor(props.docs)
  return id ? { name: 'docs' as const, hash: `#${id}` } : { name: 'docs' as const }
})
</script>

<template>
  <TooltipRoot v-if="text" :delay-duration="200">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="hint" side="top" :side-offset="6">
        <p class="hint-text">{{ text }}</p>
        <RouterLink class="hint-more" :to="docsTo">More</RouterLink>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
  <slot v-else />
</template>
