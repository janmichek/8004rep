<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Column } from '../../data/chartData'

export type Series = { key: string; label: string; color: string }

const props = withDefaults(
  defineProps<{
    title: string
    columns: Column[]
    series: Series[]
    /** Value marked with a dashed rule and its label (e.g. a mean). */
    marker?: { at: number; label: string }
    height?: number
  }>(),
  { height: 150 },
)

// Drawn at the real pixel width, so bar caps and corner radii stay true.
const plot = ref<HTMLElement>()
const W = ref(640)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry.contentRect.width > 0) W.value = entry.contentRect.width
  })
  if (plot.value) observer.observe(plot.value)
})
onBeforeUnmount(() => observer?.disconnect())

const PAD = { top: 10, right: 8, bottom: 22, left: 30 }
const GAP = 2
const MAX_BAR = 24

const hover = ref<number>()

const max = computed(() => Math.max(1, ...props.columns.map((c) => c.segments.reduce((a, s) => a + s.value, 0))))

/** 0, half and a rounded top, so tick labels stay clean integers. */
const ticks = computed(() => {
  const top = max.value <= 4 ? max.value : Math.ceil(max.value / 4) * 4
  return top <= 1 ? [0, top] : [0, top / 2, top]
})
const yTop = computed(() => ticks.value.at(-1)!)
const plotH = computed(() => props.height - PAD.top - PAD.bottom)
const slot = computed(() => (W.value - PAD.left - PAD.right) / Math.max(1, props.columns.length))
const barW = computed(() => Math.max(2, Math.min(MAX_BAR, slot.value - GAP)))

function y(value: number): number {
  return PAD.top + plotH.value - (value / yTop.value) * plotH.value
}

const colorOf = computed(() => Object.fromEntries(props.series.map((s) => [s.key, s.color])))

/** Stacked segments with a surface gap between them; only the top one gets the rounded end. */
const bars = computed(() =>
  props.columns.map((col, i) => {
    const x = PAD.left + i * slot.value + (slot.value - barW.value) / 2
    let base = 0
    const visible = col.segments.filter((s) => s.value > 0)
    const parts = visible.map((s, k) => {
      const y0 = y(base)
      base += s.value
      const y1 = y(base)
      const h = Math.max(1, y0 - y1 - (k < visible.length - 1 ? GAP : 0))
      return { key: s.key, x, y: y0 - h, h, top: k === visible.length - 1 }
    })
    return { parts }
  }),
)

/** Path of a column segment with a 4px rounded top and a square base. */
function segmentPath(x: number, top: number, w: number, h: number, round: boolean): string {
  const r = round ? Math.min(4, w / 2, h) : 0
  return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`
}

/** First, middle and last labels only: they never collide. */
const xLabels = computed(() => {
  const n = props.columns.length
  const picks = n <= 3 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1]
  return picks.map((i) => ({
    i,
    x: PAD.left + i * slot.value + slot.value / 2,
    text: props.columns[i].label,
    anchor: n > 3 && i === 0 ? 'start' : n > 3 && i === n - 1 ? 'end' : 'middle',
  }))
})

const markerX = computed(() => {
  const m = props.marker
  if (!m || props.columns.length === 0) return undefined
  // Columns are value bins of 10 starting at 0 (an extra '< 0' bin shifts them by one).
  const offset = props.columns[0].label === '< 0' ? 1 : 0
  return PAD.left + (offset + Math.min(m.at, 100) / 10) * slot.value
})

const tooltip = computed(() => {
  if (hover.value === undefined) return undefined
  const col = props.columns[hover.value]
  const left = ((PAD.left + (hover.value + 0.5) * slot.value) / W.value) * 100
  return { text: col.title, left: Math.min(85, Math.max(15, left)) }
})
</script>

<template>
  <figure class="chart">
    <figcaption class="chart-title">
      {{ title }}
      <span v-if="marker || series.length > 1" class="chart-legend">
        <span v-if="marker" class="legend-item marker-key">{{ marker.label }}</span>
        <template v-if="series.length > 1">
          <span v-for="s in series" :key="s.key" class="legend-item"><span class="swatch" :style="{ background: s.color }" />{{ s.label }}</span>
        </template>
      </span>
    </figcaption>
    <p v-if="columns.length === 0" class="muted chart-empty">Nothing dated to plot.</p>
    <div v-show="columns.length" ref="plot" class="chart-plot" @mouseleave="hover = undefined">
      <svg :viewBox="`0 0 ${W} ${height}`" :height="height" role="img" :aria-label="title">
        <g class="grid">
          <template v-for="t in ticks" :key="t">
            <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(t)" :y2="y(t)" />
          </template>
        </g>
        <g v-for="(bar, i) in bars" :key="i">
          <path
            v-for="part in bar.parts"
            :key="part.key"
            :d="segmentPath(part.x, part.y, barW, part.h, part.top)"
            :fill="colorOf[part.key]"
            :opacity="hover === undefined || hover === i ? 1 : 0.45"
          />
          <!-- Hit target: the whole slot, taller than the mark. -->
          <rect
            :x="PAD.left + i * slot"
            :y="PAD.top"
            :width="slot"
            :height="plotH"
            fill="transparent"
            @mouseenter="hover = i"
          />
        </g>
        <line v-if="markerX !== undefined" class="marker" :x1="markerX" :x2="markerX" :y1="PAD.top" :y2="PAD.top + plotH" />
      </svg>
      <div class="chart-y">
        <span v-for="t in ticks" :key="t" :style="{ top: `${(y(t) / height) * 100}%` }">{{ t }}</span>
      </div>
      <div class="chart-x">
        <span v-for="l in xLabels" :key="l.i" :class="`anchor-${l.anchor}`" :style="{ left: `${(l.x / W) * 100}%` }">{{ l.text }}</span>
      </div>
      <div v-if="tooltip" class="chart-tip" :style="{ left: `${tooltip.left}%` }">{{ tooltip.text }}</div>
    </div>
    <details v-if="columns.length" class="chart-table">
      <summary>Table</summary>
      <table>
        <thead>
          <tr>
            <th>{{ columns[0].label.match(/^\d{4}-/) ? 'Date' : 'Range' }}</th>
            <th v-for="s in series" :key="s.key" class="num">{{ s.label }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="col in columns.filter((c) => c.segments.length)" :key="col.label">
            <td>{{ col.label }}</td>
            <td v-for="s in series" :key="s.key" class="num">{{ col.segments.find((x) => x.key === s.key)?.value ?? 0 }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </figure>
</template>
