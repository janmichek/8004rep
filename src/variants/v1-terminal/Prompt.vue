<script setup lang="ts">
defineProps<{ cmd: string; busy?: boolean }>()
</script>

<template>
  <p class="t-prompt" :class="{ done: !busy }"><span>~/8004 $</span> <b>{{ cmd }}</b></p>
  <div class="t-out"><slot /></div>
</template>
