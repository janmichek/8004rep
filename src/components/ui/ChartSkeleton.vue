<script setup lang="ts">
import Skeleton from './Skeleton.vue'

const bars = [42, 78, 55, 96, 34, 63, 48, 84, 40, 70]
</script>

<template>
  <figure class="chart" aria-hidden="true">
    <figcaption class="chart-title">
      <Skeleton width="9em" height="0.9em" />
    </figcaption>
    <div class="chart-skel">
      <Skeleton v-for="(height, i) in bars" :key="i" :height="`${height}px`" />
    </div>
  </figure>
</template>
