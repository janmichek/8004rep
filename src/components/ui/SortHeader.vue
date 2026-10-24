<script setup lang="ts">
import Hint from './Hint.vue'

defineProps<{ label: string; numeric?: boolean; active?: 'asc' | 'desc' | null; text?: string }>()
defineEmits<{ sort: [] }>()
</script>

<template>
  <th
    :class="{ num: numeric }"
    :aria-sort="active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'"
  >
    <Hint v-if="text" :text="text">
      <button type="button" class="sort-trigger" :class="{ active }" @click="$emit('sort')">
        {{ label }}<span class="sort-caret" aria-hidden="true">{{ active === 'asc' ? '▲' : active === 'desc' ? '▼' : '↕' }}</span>
      </button>
    </Hint>
    <button v-else type="button" class="sort-trigger" :class="{ active }" @click="$emit('sort')">
      {{ label }}<span class="sort-caret" aria-hidden="true">{{ active === 'asc' ? '▲' : active === 'desc' ? '▼' : '↕' }}</span>
    </button>
  </th>
</template>
