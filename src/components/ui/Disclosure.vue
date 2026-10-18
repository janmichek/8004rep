<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

defineProps<{ label: string }>()
</script>

<template>
  <CollapsibleRoot class="disclosure">
    <CollapsibleTrigger class="disclosure-trigger">
      <span class="disclosure-chevron" aria-hidden="true" />
      {{ label }}
    </CollapsibleTrigger>
    <CollapsibleContent class="disclosure-content">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
