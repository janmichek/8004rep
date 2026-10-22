<script setup lang="ts">
withDefaults(defineProps<{ label?: string; large?: boolean }>(), { label: 'Loading', large: false })
</script>

<template>
  <span class="spinner-wrap" role="status">
    <span class="spinner" :class="{ large }" aria-hidden="true" />
    <span class="sr-only">{{ label }}</span>
  </span>
</template>
