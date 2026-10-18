<script setup lang="ts">
import { ref, watch } from 'vue'
import { resolveFeedbackText } from '../data/metadata'

const props = defineProps<{ uri: string }>()

const text = ref<string>()
const settled = ref(false)

watch(
  () => props.uri,
  (uri, _prev, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    text.value = undefined
    settled.value = false
    void resolveFeedbackText(uri).then((value) => {
      if (!current) return
      text.value = value
      settled.value = true
    })
  },
  { immediate: true },
)
</script>

<template>
  <span v-if="text" class="ellipsis" :title="text">“{{ text }}”</span>
  <span v-else-if="settled" class="muted">—</span>
</template>
