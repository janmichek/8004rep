<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toDisplayUrl } from '../data/metadata'

const props = defineProps<{ image?: string; label: string; pending?: boolean }>()
const src = computed(() => toDisplayUrl(props.image))
const broken = ref(false)
watch(src, () => (broken.value = false))
</script>

<template>
  <span v-if="pending" class="avatar skeleton" aria-hidden="true" />
  <span v-else class="avatar" :class="{ letter: !src || broken }">
    <img
      v-if="src && !broken"
      :src="src"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="broken = true"
    />
    <span v-else class="glyph">{{ label.trim().charAt(0).toUpperCase() || '#' }}</span>
  </span>
</template>
