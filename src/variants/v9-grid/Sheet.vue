<script setup lang="ts" generic="T">
import { computed, ref, watch } from 'vue'
import { downloadText, toCsv } from '../shared/metrics'
import { columnLetter, type Cell, type Column } from './sheet'

// Spreadsheet: click a header to sort, a cell to see its formula, ⚙ to pick columns, ⇩ for CSV.
const props = defineProps<{ rows: T[]; columns: Column<T>[]; name: string; rowClass?: (row: T) => string | undefined }>()
const emit = defineEmits<{ select: [row: T, index: number] }>()

const visible = ref(new Set(props.columns.filter((c) => !c.hidden).map((c) => c.key)))
const sortKey = ref<string>()
const desc = ref(true)
const filter = ref('')
const picker = ref(false)
const active = ref<{ r: number; c: string }>()
watch(
  () => props.rows,
  () => (active.value = undefined),
)

const cols = computed(() => props.columns.filter((c) => visible.value.has(c.key)))
const shown = computed(() => {
  const q = filter.value.trim().toLowerCase()
  let out = props.rows.map((row, i) => ({ row, i }))
  if (q) out = out.filter(({ row }) => cols.value.some((c) => String(c.show?.(row) ?? c.get(row) ?? '').toLowerCase().includes(q)))
  const col = props.columns.find((c) => c.key === sortKey.value)
  if (col) {
    const val = (r: T): Cell => col.get(r)
    out = [...out].sort((a, b) => {
      const x = val(a.row)
      const y = val(b.row)
      if (x === y) return 0
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return desc.value ? -cmp : cmp
    })
  }
  return out
})
function sortBy(key: string): void {
  if (sortKey.value === key) desc.value = !desc.value
  else {
    sortKey.value = key
    desc.value = true
  }
}
function text(c: Column<T>, row: T): string {
  if (c.show) return c.show(row)
  const v = c.get(row)
  return v === null || v === undefined ? '' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v
}
const bar = computed(() => {
  const a = active.value
  if (!a) return { ref: '', formula: `${props.name}: ${shown.value.length} rows × ${cols.value.length} columns`, value: '' }
  const ci = cols.value.findIndex((c) => c.key === a.c)
  const col = cols.value[ci]
  const item = shown.value[a.r]
  if (!col || !item) return { ref: '', formula: '', value: '' }
  return { ref: `${columnLetter(ci)}${a.r + 1}`, formula: `=${col.formula}`, value: text(col, item.row) }
})
const stats = computed(() => {
  const a = active.value
  const col = a && props.columns.find((c) => c.key === a.c)
  if (!col?.num) return ''
  const xs = shown.value.map(({ row }) => col.get(row)).filter((v): v is number => typeof v === 'number')
  if (!xs.length) return ''
  const sum = xs.reduce((s, x) => s + x, 0)
  return `SUM ${Number(sum.toFixed(2))} · AVG ${(sum / xs.length).toFixed(2)} · MIN ${Math.min(...xs)} · MAX ${Math.max(...xs)} · COUNT ${xs.length}`
})
function exportCsv(): void {
  downloadText(`${props.name.replace(/\W+/g, '-').toLowerCase()}.csv`, toCsv(cols.value.map((c) => c.label), shown.value.map(({ row }) => cols.value.map((c) => c.get(row)))))
}
function toggle(key: string): void {
  const next = new Set(visible.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  visible.value = next
}
</script>

<template>
  <div class="x-sheet">
    <div class="x-tool">
      <span class="x-ref">{{ bar.ref || '—' }}</span>
      <span class="x-fx">ƒx</span>
      <code class="x-formula" :title="bar.formula">{{ bar.formula }}</code>
      <input v-model="filter" type="search" placeholder="Filter rows" aria-label="Filter rows" class="x-filter" />
      <button title="Choose columns" :aria-expanded="picker" @click="picker = !picker">⚙ Columns</button>
      <button title="Download the visible rows and columns" @click="exportCsv">⇩ CSV</button>
    </div>
    <div v-if="picker" class="x-picker">
      <label v-for="c in columns" :key="c.key"><input type="checkbox" :checked="visible.has(c.key)" @change="toggle(c.key)" /> {{ c.label }}</label>
    </div>
    <div class="x-scroll">
      <table class="x-table">
        <thead>
          <tr class="x-letters"><th /><th v-for="(c, i) in cols" :key="c.key">{{ columnLetter(i) }}</th></tr>
          <tr>
            <th class="x-corner">#</th>
            <th v-for="c in cols" :key="c.key" :class="{ num: c.num, sorted: sortKey === c.key }" :style="{ minWidth: c.width }" :title="c.formula" @click="sortBy(c.key)">
              {{ c.label }}<span v-if="sortKey === c.key">{{ desc ? ' ▼' : ' ▲' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, r) in shown" :key="item.i" :class="rowClass?.(item.row)" @dblclick="emit('select', item.row, item.i)">
            <th class="x-rownum">{{ r + 1 }}</th>
            <td
              v-for="c in cols"
              :key="c.key"
              :class="[{ num: c.num, active: active?.r === r && active.c === c.key }, c.tone?.(item.row)]"
              @click="active = { r, c: c.key }"
            >
              <RouterLink v-if="c.link?.(item.row)" :to="c.link(item.row)!">{{ text(c, item.row) }}</RouterLink>
              <a v-else-if="c.href?.(item.row)" :href="c.href(item.row)" target="_blank" rel="noopener noreferrer">{{ text(c, item.row) }}</a>
              <template v-else>{{ text(c, item.row) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="x-status"><span>{{ shown.length }} of {{ rows.length }} rows</span><span>{{ stats }}</span></div>
  </div>
</template>
