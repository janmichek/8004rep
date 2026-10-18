<script setup lang="ts">
import Skeleton from './Skeleton.vue'

withDefaults(defineProps<{ count?: number }>(), { count: 6 })
</script>

<template>
  <div class="tiles" aria-hidden="true">
    <div v-for="i in count" :key="i" class="tile">
      <Skeleton width="62%" height="0.7em" />
      <Skeleton width="46%" height="1.35em" />
      <Skeleton width="74%" height="0.7em" />
    </div>
  </div>
</template>
