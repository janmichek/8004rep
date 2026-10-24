<script setup lang="ts">
import ChainIcon from './ChainIcon.vue'

withDefaults(defineProps<{ chainId?: number; name: string; size?: number }>(), { size: 16 })
</script>

<template>
  <span class="chain-label">
    <ChainIcon :chain-id="chainId" :name="name" :size="size" />
    <span class="chain-label-text">{{ name }}</span>
  </span>
</template>

<style scoped>
.chain-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
}

.chain-label-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
