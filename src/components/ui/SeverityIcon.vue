<script setup lang="ts">
import type { Component } from 'vue'
import { CircleAlert, Info, ShieldCheck, TriangleAlert } from '@lucide/vue'
import type { RiskLevel } from '../../data/feedbackStats'

type Level = RiskLevel | 'clean'

defineProps<{ level: Level }>()

const ICONS: Record<Level, Component> = {
  high: TriangleAlert,
  warn: CircleAlert,
  info: Info,
  clean: ShieldCheck,
}

const WORDS: Record<Level, string> = {
  high: 'High risk',
  warn: 'Needs a look',
  info: 'Notes only',
  clean: 'No findings',
}
</script>

<template>
  <span class="severity-icon" :title="WORDS[level]" role="img" :aria-label="WORDS[level]">
    <component :is="ICONS[level]" :size="14" :stroke-width="2" aria-hidden="true" />
  </span>
</template>
