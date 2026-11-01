<script setup lang="ts">
import { computed } from 'vue'
import { cityName, loadOverview } from '../../places/overview'
import { useAsync } from '../../useAsync'
import { gapClass, stars } from './use'

const props = defineProps<{ slug: string }>()
const { data, error, loading, reload } = useAsync(() => loadOverview(props.slug), () => props.slug)
const max = computed(() => Math.max(1, ...(data.value?.histogram ?? []).flatMap((h) => [h.google, h.filtered])))
</script>

<template>
  <p class="m-label">Overview</p>
  <h1>{{ cityName(slug) }}</h1>
  <p v-if="error" class="m-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || !data" class="m-soft">Scoring a sample…</p>
  <template v-else>
    <div class="m-tiles">
      <div class="m-tile"><span class="m-label">Places</span><b>{{ data.places.toLocaleString() }}</b><small>{{ data.sampled }} scored in full</small></div>
      <div class="m-tile"><span class="m-label">Google mean</span><b>{{ stars(data.googleMean) }}★</b></div>
      <div class="m-tile main"><span class="m-label">Filtered mean</span><b>{{ stars(data.filteredMean) }}★</b></div>
      <div class="m-tile"><span class="m-label">Inflated</span><b>{{ Math.round(data.inflatedShare * 100) }}%</b><small>of places ≥0.5★ above filtered</small></div>
    </div>

    <h2>Ratings, Google vs filtered</h2>
    <div class="m-dist">
      <div v-for="h in data.histogram" :key="h.stars" class="m-dist-row">
        <span>{{ h.stars }}★</span>
        <span class="bar"><i class="raw" :style="{ width: (h.google / max) * 100 + '%' }" /><i class="wt" :style="{ width: (h.filtered / max) * 100 + '%' }" /></span>
        <span class="r">{{ h.google }} → {{ h.filtered }}</span>
      </div>
    </div>

    <h2>Most inflated in the sample</h2>
    <table class="m-table">
      <thead><tr><th>Place</th><th class="r">Google</th><th class="r">Filtered</th><th class="r">Gap</th></tr></thead>
      <tbody>
        <tr v-for="{ place, rep } in data.worst" :key="place.id">
          <td><RouterLink :to="{ name: 'agent', params: { slug, id: place.id } }"><b>{{ place.displayName.text }}</b></RouterLink><div class="m-soft">{{ place.primaryTypeDisplayName.text }} · {{ place.formattedAddress }}</div></td>
          <td class="r">{{ stars(place.rating) }}★</td>
          <td class="r"><b>{{ stars(rep.score) }}★</b></td>
          <td class="r" :class="gapClass(rep.inflation)">{{ rep.inflation === null ? '—' : '+' + rep.inflation.toFixed(1) }}</td>
        </tr>
      </tbody>
    </table>
  </template>
</template>
