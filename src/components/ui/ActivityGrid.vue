<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * GitHub-style contribution grid: one small square per UTC day, weeks as
 * columns, Sunday on top. Paginated one calendar year at a time.
 */
const props = defineProps<{ times: number[]; label?: string }>()

const DAY = 86400
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Count per UTC day index (unix seconds / 86400). */
const perDay = computed(() => {
  const map = new Map<number, number>()
  for (const t of props.times) {
    const d = Math.floor(t / DAY)
    map.set(d, (map.get(d) ?? 0) + 1)
  }
  return map
})

const years = computed(() => {
  const days = [...perDay.value.keys()]
  if (days.length === 0) return []
  const first = new Date(Math.min(...days) * DAY * 1000).getUTCFullYear()
  const last = new Date(Math.max(...days) * DAY * 1000).getUTCFullYear()
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
})

const pageIndex = ref(0)
// Start on the newest year; reset when the data changes.
watch(years, (list) => (pageIndex.value = Math.max(0, list.length - 1)), { immediate: true })

const year = computed(() => years.value[pageIndex.value])
const hasPrev = computed(() => pageIndex.value > 0)
const hasNext = computed(() => pageIndex.value < years.value.length - 1)

interface Cell {
  day: number
  date: string
  count: number
  level: number
}

/** Weeks (columns) of 7 cells; null pads the first and last week. */
const weeks = computed<(Cell | null)[][]>(() => {
  const y = year.value
  if (y === undefined) return []
  const start = Date.UTC(y, 0, 1) / 1000 / DAY
  const end = Date.UTC(y + 1, 0, 1) / 1000 / DAY
  const startWeekday = new Date(start * DAY * 1000).getUTCDay()

  const cells: (Cell | null)[] = Array.from({ length: startWeekday }, () => null)
  const yearCounts: number[] = []
  for (let d = start; d < end; d++) {
    const count = perDay.value.get(d) ?? 0
    yearCounts.push(count)
    cells.push({ day: d, date: new Date(d * DAY * 1000).toISOString().slice(0, 10), count, level: 0 })
  }
  // Intensity relative to this year's busiest day, GitHub-style 1–4.
  const max = Math.max(0, ...yearCounts)
  for (const c of cells) {
    if (!c || c.count === 0) continue
    c.level = Math.min(4, Math.max(1, Math.ceil((c.count / max) * 4)))
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const out: (Cell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
  return out
})

/** Month label above the first week that contains the 1st of that month. */
const monthLabels = computed(() => {
  const y = year.value
  if (y === undefined) return []
  const labels: { col: number; text: string }[] = []
  weeks.value.forEach((week, col) => {
    const first = week.find((c) => c && c.date.endsWith('-01'))
    if (first) labels.push({ col, text: MONTHS[Number(first!.date.slice(5, 7)) - 1] })
  })
  return labels
})

const total = computed(() => {
  const y = year.value
  if (y === undefined) return 0
  let n = 0
  for (const [d, c] of perDay.value) if (new Date(d * DAY * 1000).getUTCFullYear() === y) n += c
  return n
})
const activeDays = computed(() => weeks.value.flat().filter((c) => c && c.count > 0).length)

const DAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' }

function cellTitle(c: Cell): string {
  return `${c.date} · ${c.count} feedback${c.count === 1 ? '' : 's'}`
}
</script>

<template>
  <section class="panel activity">
    <div class="activity-head">
      <h3>{{ label ?? 'Activity' }}</h3>
      <div v-if="years.length" class="pager" role="group" aria-label="Change year">
        <button type="button" :disabled="!hasPrev" aria-label="Previous year" @click="pageIndex--">‹</button>
        <span class="mono year" aria-live="polite">{{ year }}</span>
        <button type="button" :disabled="!hasNext" aria-label="Next year" @click="pageIndex++">›</button>
      </div>
    </div>
    <p v-if="!years.length" class="muted summary">No dated feedback, so there is no activity to plot.</p>
    <p v-else class="muted summary">
      {{ total }} feedback in {{ year }} · {{ activeDays }} active day{{ activeDays === 1 ? '' : 's' }}
    </p>

    <div v-if="years.length" class="grid-scroll">
      <div class="grid-wrap">
        <div class="month-row" aria-hidden="true">
          <span
            v-for="m in monthLabels"
            :key="m.col"
            class="month"
            :style="{ left: `${m.col * 14}px` }"
          >{{ m.text }}</span>
        </div>
        <div class="grid-body">
          <div class="day-labels" aria-hidden="true">
            <span v-for="row in 7" :key="row">{{ DAY_LABELS[row - 1] ?? '' }}</span>
          </div>
          <div class="weeks" role="img" :aria-label="`Feedback per day in ${year}`">
            <div v-for="(week, col) in weeks" :key="col" class="week">
              <template v-for="(c, row) in week" :key="row">
                <span
                  v-if="c"
                  class="cell"
                  :class="`l${c.level}`"
                  :title="cellTitle(c)"
                  :aria-label="cellTitle(c)"
                />
                <span v-else class="cell pad" aria-hidden="true" />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="years.length" class="legend muted" aria-hidden="true">
      <span>Less</span>
      <span v-for="n in 5" :key="n" class="cell" :class="`l${n - 1}`" />
      <span>More</span>
    </div>
  </section>
</template>

<style scoped>
.activity-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.activity-head h3 {
  margin: 0;
}

.pager {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pager button {
  padding: 2px 10px;
  line-height: 1.2;
}

.year {
  min-width: 3.5em;
  text-align: center;
}

.summary {
  margin: 4px 0 10px;
  font-size: 12px;
}

.grid-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.grid-wrap {
  display: inline-block;
}

/* 11px squares + 3px gap = 14px per week column. */
.grid-wrap {
  --cell: 11px;
  --gap: 3px;
}

/* Month labels are placed on week columns, offset by the 28px day-label gutter. */
.month-row {
  position: relative;
  height: 14px;
  margin: 0 0 2px 28px;
  font-size: 11px;
  color: var(--muted);
}

.month {
  position: absolute;
  top: 0;
  white-space: nowrap;
}

.grid-body {
  display: flex;
  align-items: flex-start;
}

.day-labels {
  width: 28px;
  flex: none;
  display: flex;
  flex-direction: column;
  row-gap: var(--gap);
  font-size: 10px;
  color: var(--muted);
}

.day-labels span {
  height: var(--cell);
  line-height: var(--cell);
}

.weeks {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--cell);
  column-gap: var(--gap);
}

.week {
  display: grid;
  grid-template-rows: repeat(7, var(--cell));
  row-gap: var(--gap);
}

.cell {
  display: inline-block;
  width: var(--cell);
  height: var(--cell);
  border-radius: 2px;
  background: color-mix(in srgb, var(--line) 70%, var(--panel));
}

.cell.pad {
  background: transparent;
}

.cell.l1 { background: color-mix(in srgb, #22d3ee 28%, var(--panel)); }
.cell.l2 { background: color-mix(in srgb, #22d3ee 50%, var(--panel)); }
.cell.l3 { background: color-mix(in srgb, #22d3ee 75%, var(--panel)); }
.cell.l4 { background: #22d3ee; }

.cell:not(.pad):hover {
  outline: 1px solid var(--text);
  outline-offset: -1px;
}

.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
}

.legend .cell {
  --cell: 10px;
}
</style>
