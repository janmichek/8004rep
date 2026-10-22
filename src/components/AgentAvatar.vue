<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { imageUrls } from '../data/metadata'
import Spinner from './ui/Spinner.vue'

const props = defineProps<{ image?: string; label: string; pending?: boolean }>()

const sources = computed(() => imageUrls(props.image))
const index = ref(0)
const failed = ref(false)
const src = computed(() => sources.value[index.value])

watch(sources, () => {
  index.value = 0
  failed.value = false
})

function onError(): void {
  if (index.value < sources.value.length - 1) index.value++
  else failed.value = true
}
</script>

<template>
  <span v-if="pending" class="avatar" aria-hidden="true"><Spinner /></span>
  <span v-else class="avatar" :class="{ letter: !src || failed }">
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="onError"
    />
    <span v-else class="glyph">{{ label.trim().charAt(0).toUpperCase() || '#' }}</span>
  </span>
</template>
