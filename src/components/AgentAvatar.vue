<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toDisplayUrl } from '../data/metadata'

const props = defineProps<{ image?: string; label: string }>()

const src = computed(() => toDisplayUrl(props.image))
const broken = ref(false)
watch(src, () => (broken.value = false))
</script>

<template>
  <span class="avatar">
    <img
      v-if="src && !broken"
      :src="src"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="broken = true"
    />
    <template v-else>{{ label.trim().charAt(0).toUpperCase() || '#' }}</template>
  </span>
</template>
