<script setup lang="ts">
import Skeleton from './Skeleton.vue'

withDefaults(
  defineProps<{
    label: string
    headers: string[]
    numeric?: string[]
    rows?: number
  }>(),
  { rows: 8, numeric: () => [] },
)

function barWidth(row: number, col: number): string {
  if (col === 0) return `${46 + ((row + col) % 4) * 12}%`
  return `${2.2 + ((row * 3 + col) % 4) * 0.7}em`
}
</script>

<template>
  <div class="table-wrap" aria-busy="true">
    <span class="sr-only">{{ label }}</span>
    <table aria-hidden="true">
      <thead>
        <tr>
          <th v-for="header in headers" :key="header" :class="{ num: numeric.includes(header) }">{{ header }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row">
          <td v-for="(header, col) in headers" :key="header" :class="{ num: numeric.includes(header) }">
            <div v-if="col === 0" class="agent-cell">
              <Skeleton width="32px" height="32px" radius="8px" />
              <span class="agent-name">
                <Skeleton :width="barWidth(row, col)" />
                <Skeleton width="72%" height="0.65em" />
              </span>
            </div>
            <Skeleton v-else :width="barWidth(row, col)" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
