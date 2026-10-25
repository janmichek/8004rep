<script setup lang="ts">
import CountUp from './CountUp.vue'
import Hint from './Hint.vue'
import Skeleton from './Skeleton.vue'

/** 0–100 score bar; optional band for an interval overlay. */
export type GaugeMeter = {
  kind: 'gauge'
  value: number | null
  band?: [number, number] | null
}

/** Discrete steps (e.g. confidence low/medium/high). */
export type StepsMeter = {
  kind: 'steps'
  filled: number
  total: number
}

/** Severity ladder (0 = clean … max = worst). */
export type SeverityMeter = {
  kind: 'severity'
  level: number
  max: number
}

export type TileMeter = GaugeMeter | StepsMeter | SeverityMeter

export type Tile = {
  label: string
  value: string
  hint?: string
  /** Rule or source behind the number, shown on hover. */
  title?: string
  tone?: 'main' | 'good' | 'warn' | 'bad' | 'quiet'
  /** Words rather than a number: set in smaller type. */
  word?: boolean
  /** Value is still being fetched. */
  loading?: boolean
  /** Optional mini chart under the value. */
  meter?: TileMeter
}

defineProps<{ tiles: Tile[] }>()

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n))
}
</script>

<template>
  <div class="tiles">
    <Hint v-for="tile in tiles" :key="tile.label" :text="tile.title">
      <div
        class="tile"
        :class="[tile.tone && `tone-${tile.tone}`, tile.meter && 'has-meter']"
        :tabindex="tile.title ? 0 : undefined"
      >
        <div class="tile-label">{{ tile.label }}</div>
        <div class="tile-value" :class="{ word: tile.word && !tile.loading }">
          <Skeleton v-if="tile.loading" width="3.2em" height="1.25em" />
          <CountUp v-else :value="tile.value" />
        </div>
        <div v-if="tile.loading" class="tile-hint"><Skeleton width="72%" height="0.7em" /></div>
        <div v-else-if="tile.hint" class="tile-hint">{{ tile.hint }}</div>

        <div v-if="tile.meter && !tile.loading" class="tile-meter" aria-hidden="true">
          <template v-if="tile.meter.kind === 'gauge'">
            <div class="tile-gauge">
              <span
                v-if="tile.meter.band"
                class="tile-gauge-band"
                :style="{
                  left: `${clampPct(tile.meter.band[0])}%`,
                  width: `${clampPct(tile.meter.band[1] - tile.meter.band[0])}%`,
                }"
              />
              <span
                class="tile-gauge-fill"
                :style="{ width: tile.meter.value === null ? '0%' : `${clampPct(tile.meter.value)}%` }"
              />
              <span
                v-if="tile.meter.value !== null"
                class="tile-gauge-mark"
                :style="{ left: `${clampPct(tile.meter.value)}%` }"
              />
            </div>
          </template>

          <template v-else-if="tile.meter.kind === 'steps'">
            <div class="tile-steps" :style="{ '--steps': tile.meter.total }">
              <span
                v-for="i in tile.meter.total"
                :key="i"
                class="tile-step"
                :class="{ on: i <= tile.meter.filled }"
              />
            </div>
          </template>

          <template v-else-if="tile.meter.kind === 'severity'">
            <div class="tile-severity" :style="{ '--segs': tile.meter.max }">
              <span
                v-for="i in tile.meter.max"
                :key="i"
                class="tile-sev"
                :class="{ on: i <= tile.meter.level }"
              />
            </div>
          </template>
        </div>
      </div>
    </Hint>
  </div>
</template>
