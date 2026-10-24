<script setup lang="ts">
import type { Component } from 'vue'
import { Activity, Ban, Copy, Crosshair, Link2Off, Repeat2, Ruler, UserX, Zap } from '@lucide/vue'
import { FLAG_INFO, type RowFlag } from '../../data/feedbackStats'

defineProps<{ flag: RowFlag }>()

const ICONS: Record<RowFlag, Component> = {
  revoked: Ban,
  self: UserX,
  duplicate: Copy,
  burst: Zap,
  monotonous: Repeat2,
  hyperactive: Activity,
  outlier: Crosshair,
  'out-of-range': Ruler,
  'unlisted-endpoint': Link2Off,
}
</script>

<template>
  <span class="chip flag-chip" :class="`flag-${flag}`">
    <component :is="ICONS[flag]" :size="12" :stroke-width="2" aria-hidden="true" />
    {{ FLAG_INFO[flag].label }}
  </span>
</template>
