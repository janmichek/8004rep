<script setup lang="ts">
import { ref, watch } from 'vue'
import { resolveFeedbackText } from '../data/metadata'

const props = defineProps<{ uri: string; colspan: number; open?: boolean }>()

const text = ref<string>()

watch(
  () => props.uri,
  (uri, _prev, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    text.value = undefined
    void resolveFeedbackText(uri).then((value) => {
      if (current) text.value = value
    })
  },
  { immediate: true },
)
</script>

<template>
  <tr v-if="text" class="note-row" :class="{ open }">
    <td :colspan="colspan">
      <p class="feedback-note">
        <span class="feedback-note-label" title="The text (or comment) field of the off-chain feedback file">Feedback text</span>
        <span class="feedback-note-body" :title="text">“{{ text }}”</span>
      </p>
    </td>
  </tr>
</template>
