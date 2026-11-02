<script setup lang="ts">
import type { Component } from 'vue'
import Skeleton from './Skeleton.vue'

/** A number the page is built on, shown as a pill under the title. */
export type PageFact = {
  value: string
  label: string
  tone?: 'warn' | 'good'
}

withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Page mark, drawn in a tinted tile next to the title. */
    icon?: Component
    facts?: PageFact[]
    /** Caveat or window explanation under the facts. */
    note?: string
    /** Show placeholder pills while the first rows are on their way. */
    loading?: boolean
  }>(),
  { facts: () => [], loading: false },
)
</script>

<template>
  <header class="page-header">
    <div class="page-header-row">
      <div class="page-header-text">
        <span v-if="icon" class="page-header-icon" aria-hidden="true">
          <component :is="icon" :size="22" :stroke-width="1.6" />
        </span>
        <div class="page-header-title">
          <h1>{{ title }}</h1>
          <p v-if="description" class="page-header-sub">{{ description }}</p>
        </div>
      </div>

      <div v-if="$slots.actions" class="page-header-actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="loading || facts.length || note" class="page-header-foot">
      <div v-if="loading" class="page-header-facts" aria-hidden="true">
        <span class="page-fact"><Skeleton width="2.4em" height="0.75em" /></span>
        <span class="page-fact"><Skeleton width="3.2em" height="0.75em" /></span>
        <span class="page-fact"><Skeleton width="2em" height="0.75em" /></span>
      </div>
      <ul v-else-if="facts.length" class="page-header-facts">
        <li v-for="fact in facts" :key="fact.label" class="page-fact" :class="fact.tone && `tone-${fact.tone}`">
          <b>{{ fact.value }}</b> {{ fact.label }}
        </li>
      </ul>
      <p v-if="note" class="page-header-note">{{ note }}</p>
    </div>
  </header>
</template>
