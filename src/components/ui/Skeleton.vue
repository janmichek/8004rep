<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
    /** CSS border-radius. Pills and avatars pass their own. */
    radius?: string
    /** Stretch to the full width of the parent instead of sitting inline. */
    block?: boolean
  }>(),
  { width: '100%', height: '0.85em' },
)
</script>

<template>
  <span class="skeleton" :class="{ block }" :style="{ width, height, borderRadius: radius }" aria-hidden="true" />
</template>
