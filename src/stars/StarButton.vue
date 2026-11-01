<script setup lang="ts">
import { computed } from 'vue'
import { isStarred, toggleStar, type StarKind } from './index'

const props = withDefaults(
  defineProps<{
    kind: StarKind
    chainId: number
    id: string | bigint
    /** Shown in the starred list; the page's current name or address. */
    label: string
    /** Agent image, stored with the star for the starred list. */
    image?: string
    /** `icon` for table rows; `label` for page headers. */
    variant?: 'icon' | 'label'
  }>(),
  { variant: 'label' },
)

const on = computed(() => isStarred(props.kind, props.chainId, props.id))

function onToggle(event: Event): void {
  // Table rows are links as a whole; a star must not also open the row.
  event.stopPropagation()
  toggleStar({ kind: props.kind, chainId: props.chainId, id: props.id, label: props.label, image: props.image })
}
</script>

<template>
  <button
    v-if="variant === 'icon'"
    type="button"
    class="star-icon-btn"
    :class="{ on }"
    :aria-pressed="on"
    :aria-label="on ? `Remove ${label} from starred` : `Star ${label}`"
    :title="on ? 'Remove from starred' : 'Star'"
    @click="onToggle"
  >
    ★
  </button>
  <button v-else type="button" class="filter-toggle star-toggle" :class="{ on }" :aria-pressed="on" @click="onToggle">
    <span aria-hidden="true">{{ on ? '★' : '☆' }}</span> {{ on ? 'Starred' : 'Star' }}
  </button>
</template>

<style scoped>
.star-toggle span {
  font-size: 0.95em;
}

.star-icon-btn {
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

.star-icon-btn:hover {
  color: var(--text);
  border-color: var(--line);
  background: var(--panel);
}

.star-icon-btn.on {
  color: var(--accent);
}
</style>
