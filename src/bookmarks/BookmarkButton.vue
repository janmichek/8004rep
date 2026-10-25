<script setup lang="ts">
import { computed } from 'vue'
import { isBookmarked, toggleBookmark } from './index'

const props = withDefaults(
  defineProps<{
    chainId: number
    tokenId: string | bigint
    testnet: boolean
    /** `star` for table rows; `label` for agent headers. */
    variant?: 'star' | 'label'
    label?: string
  }>(),
  { variant: 'label' },
)

const saved = computed(() => isBookmarked(props.chainId, props.tokenId, props.testnet))
const name = computed(() => props.label || `Agent #${props.tokenId}`)

function onToggle(event: Event): void {
  event.stopPropagation()
  toggleBookmark(props.chainId, props.tokenId, props.testnet)
}
</script>

<template>
  <button
    v-if="variant === 'star'"
    type="button"
    class="bookmark-btn"
    :class="{ on: saved }"
    :aria-pressed="saved"
    :aria-label="saved ? `Remove ${name} from saved` : `Save ${name}`"
    :title="saved ? 'Remove from saved' : 'Save agent'"
    @click="onToggle"
  >
    ★
  </button>
  <button
    v-else
    type="button"
    class="filter-toggle"
    :class="{ on: saved }"
    :aria-pressed="saved"
    @click="onToggle"
  >
    {{ saved ? 'Saved' : 'Save' }}
  </button>
</template>

<style scoped>
.bookmark-btn {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: color-mix(in srgb, var(--muted) 70%, transparent);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
}

.bookmark-btn:hover {
  color: var(--text);
  border-color: var(--line);
  background: var(--panel);
}

.bookmark-btn.on {
  color: var(--accent);
}
</style>
