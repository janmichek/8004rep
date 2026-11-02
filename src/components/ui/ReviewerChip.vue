<script setup lang="ts">
import type { Component } from 'vue'
import { Files, Stamp, ThumbsDown, UserRound, Users } from '@lucide/vue'
import { LABEL_INFO, type ReviewerLabel } from '../../data/reviewerProfile'

defineProps<{ label: ReviewerLabel }>()

const ICONS: Record<ReviewerLabel, Component> = {
  'rubber-stamp': Stamp,
  'single-agent': UserRound,
  bulk: Files,
  mass: Users,
  harsh: ThumbsDown,
}
</script>

<template>
  <span class="chip reviewer-chip" :class="`reviewer-${label}`">
    <component :is="ICONS[label]" :size="12" :stroke-width="2" aria-hidden="true" />
    {{ LABEL_INFO[label].label }}
  </span>
</template>
