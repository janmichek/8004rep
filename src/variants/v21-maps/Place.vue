<script setup lang="ts">
import { computed, ref } from 'vue'
import { scorePlace, TEMPLATE_FACTOR } from '../../places/score'
import { placesSource } from '../../places/source'
import { useAsync } from '../../useAsync'
import { gapClass, stars } from './use'

const props = defineProps<{ slug: string; id: string }>()
const { data: place, error, loading, reload } = useAsync(() => placesSource.getPlace(props.id), () => props.id)
const rep = computed(() => (place.value ? scorePlace(place.value, place.value.reviews ?? []) : undefined))
const onlyFlagged = ref(false)
const rows = computed(() => (rep.value?.scored ?? []).filter((s) => !onlyFlagged.value || s.flags.length))
const maxCount = computed(() => Math.max(1, ...(rep.value?.distribution ?? []).map((d) => d.count)))
const maxWeight = computed(() => Math.max(1e-9, ...(rep.value?.distribution ?? []).map((d) => d.weight)))
const date = (iso: string) => iso.slice(0, 10)
</script>

<template>
  <p v-if="error" class="m-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || place === undefined" class="m-soft">Loading…</p>
  <section v-else-if="place === null" class="m-state"><h1>No place {{ id }}</h1></section>
  <template v-else-if="rep">
    <p class="m-label"><RouterLink :to="{ name: 'agents', params: { slug } }">Places</RouterLink> / {{ place.primaryTypeDisplayName.text }}</p>
    <h1 class="m-title">{{ place.displayName.text }}</h1>
    <p class="m-soft">{{ place.formattedAddress }} · <a :href="place.googleMapsUri" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>

    <div class="m-tiles">
      <div class="m-tile"><span class="m-label">Google</span><b>{{ stars(place.rating) }}★</b><small>{{ place.userRatingCount?.toLocaleString() }} reviews</small></div>
      <div class="m-tile main">
        <span class="m-label">Filtered score</span><b>{{ stars(rep.score) }}★</b>
        <small v-if="rep.interval">80% range {{ stars(rep.interval[0]) }}–{{ stars(rep.interval[1]) }}</small>
      </div>
      <div class="m-tile"><span class="m-label">Gap</span><b :class="gapClass(rep.inflation)">{{ rep.inflation === null ? '—' : (rep.inflation > 0 ? '+' : '') + rep.inflation.toFixed(1) }}</b><small>Google − filtered</small></div>
      <div class="m-tile"><span class="m-label">Confidence</span><b><span class="m-chip" :class="rep.confidence">{{ rep.confidence }}</span></b><small>{{ rep.neff.toFixed(0) }} effective reviewers</small></div>
      <div class="m-tile"><span class="m-label">Cost to fake</span><b>{{ rep.cost === null ? '—' : rep.cost }}</b><small>fresh accounts to reach 4.6★</small></div>
    </div>

    <ul v-if="rep.findings.length" class="m-findings">
      <li v-for="f in rep.findings" :key="f.code" :class="f.level"><b>{{ f.level }}</b> {{ f.text }}</li>
    </ul>

    <h2>Distribution</h2>
    <p class="m-soft">Of the {{ rep.reviews }} reviews returned. Bars: raw count (grey) and trust-weighted (blue).</p>
    <div class="m-dist">
      <div v-for="d in rep.distribution" :key="d.stars" class="m-dist-row">
        <span>{{ d.stars }}★</span>
        <span class="bar"><i class="raw" :style="{ width: (d.count / maxCount) * 100 + '%' }" /><i class="wt" :style="{ width: (d.weight / maxWeight) * 100 + '%' }" /></span>
        <span class="r">{{ d.count }}</span>
      </div>
    </div>

    <h2>Reviews</h2>
    <label class="m-check"><input v-model="onlyFlagged" type="checkbox" /> Only flagged ({{ rep.scored.filter((s) => s.flags.length).length }})</label>
    <table class="m-table">
      <thead><tr><th>Reviewer</th><th class="r">Rating</th><th>Review</th><th class="r">Trust</th><th class="r">Weight</th><th class="r">When</th></tr></thead>
      <tbody>
        <tr v-for="s in rows" :key="s.review.name" :class="{ dim: s.weight < 0.25 }">
          <td>
            <a :href="s.review.authorAttribution.uri" target="_blank" rel="noopener noreferrer">{{ s.review.authorAttribution.displayName }}</a>
            <div class="m-soft">
              {{ s.review.authorStats?.reviewCount ?? '?' }} reviews<span v-if="s.review.authorStats?.localGuideLevel"> · Local Guide L{{ s.review.authorStats.localGuideLevel }}</span>
            </div>
          </td>
          <td class="r">{{ s.review.rating }}★</td>
          <td class="text">
            {{ s.review.text?.text ?? '—' }}
            <span v-for="f in s.flags" :key="f" class="m-chip warn" :title="f === 'template' ? `Weight ×${TEMPLATE_FACTOR}` : undefined">{{ f }}</span>
          </td>
          <td class="r">{{ s.credibility.toFixed(2) }}</td>
          <td class="r"><b>{{ s.weight.toFixed(2) }}</b></td>
          <td class="r m-soft" :title="date(s.review.publishTime)">{{ s.review.relativePublishTimeDescription }}</td>
        </tr>
      </tbody>
    </table>
  </template>
</template>
