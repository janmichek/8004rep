<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { scorePlace } from '../../places/score'
import { PLACE_TYPES, placesSource } from '../../places/source'
import type { PlaceSort } from '../../places/types'
import { useAsync } from '../../useAsync'
import { gapClass, stars } from './use'

const PAGE_SIZE = 25
const props = defineProps<{ slug: string }>()
const route = useRoute()
const router = useRouter()

const page = computed(() => Math.max(0, Math.trunc(Number(route.query.page) || 1) - 1))
const q = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const type = computed(() => (typeof route.query.type === 'string' ? route.query.type : ''))
const sort = computed<PlaceSort>(() => (route.query.sort === 'rating' || route.query.sort === 'name' ? route.query.sort : 'reviews'))

const { data, error, loading, reload } = useAsync(
  async () => {
    const res = await placesSource.search({
      city: props.slug,
      q: q.value || undefined,
      type: type.value || undefined,
      sort: sort.value,
      page: page.value,
      pageSize: PAGE_SIZE,
      withReviews: true,
    })
    return { total: res.total, rows: res.places.map((place) => ({ place, rep: scorePlace(place, place.reviews ?? []) })) }
  },
  () => [props.slug, q.value, type.value, sort.value, page.value],
)

const input = ref('')
watch(q, (v) => (input.value = v), { immediate: true })

function push(next: { q?: string; type?: string; sort?: string; page?: number }): void {
  const query: Record<string, string> = {}
  const nq = next.q ?? q.value
  const nt = next.type ?? type.value
  const ns = next.sort ?? sort.value
  if (nq) query.q = nq
  if (nt) query.type = nt
  if (ns !== 'reviews') query.sort = ns
  if (next.page) query.page = String(next.page + 1)
  void router.push({ query })
}
const pages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / PAGE_SIZE)))
</script>

<template>
  <div class="m-head">
    <div>
      <p class="m-label">Places</p>
      <h1>{{ data ? data.total.toLocaleString() : loading ? '…' : '—' }}</h1>
    </div>
    <form class="m-filters" @submit.prevent="push({ q: input.trim() })">
      <input v-model="input" type="search" placeholder="Search by name" aria-label="Search places" />
      <select :value="type" aria-label="Type" @change="push({ type: ($event.target as HTMLSelectElement).value })">
        <option value="">All types</option>
        <option v-for="t in PLACE_TYPES" :key="t.type" :value="t.type">{{ t.label }}</option>
      </select>
      <select :value="sort" aria-label="Sort" @change="push({ sort: ($event.target as HTMLSelectElement).value })">
        <option value="reviews">Most reviewed</option>
        <option value="rating">Google rating</option>
        <option value="name">Name</option>
      </select>
      <button type="submit">Search</button>
    </form>
  </div>

  <p v-if="error" class="m-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading" class="m-soft">Loading…</p>
  <p v-else-if="data && !data.rows.length" class="m-soft">Nothing matches.</p>
  <template v-else-if="data">
    <table class="m-table">
      <thead>
        <tr><th>Place</th><th>Type</th><th class="r">Reviews</th><th class="r">Google</th><th class="r">Filtered</th><th class="r">Gap</th><th>Confidence</th></tr>
      </thead>
      <tbody>
        <tr v-for="{ place, rep } in data.rows" :key="place.id">
          <td>
            <RouterLink :to="{ name: 'agent', params: { slug, id: place.id } }"><b>{{ place.displayName.text }}</b></RouterLink>
            <div class="m-soft">{{ place.formattedAddress }}</div>
          </td>
          <td>{{ place.primaryTypeDisplayName.text }}</td>
          <td class="r">{{ place.userRatingCount?.toLocaleString() }}</td>
          <td class="r">{{ stars(place.rating) }}★</td>
          <td class="r"><b>{{ stars(rep.score) }}★</b></td>
          <td class="r" :class="gapClass(rep.inflation)">{{ rep.inflation === null ? '—' : (rep.inflation > 0 ? '+' : '') + rep.inflation.toFixed(1) }}</td>
          <td><span class="m-chip" :class="rep.confidence">{{ rep.confidence }}</span><span v-if="rep.findings.some((f) => f.level === 'warn')" class="m-chip warn" title="Suspicious reviews found">flags</span></td>
        </tr>
      </tbody>
    </table>
    <nav v-if="pages > 1" class="m-pager">
      <button :disabled="page === 0" @click="push({ page: page - 1 })">Previous</button>
      <span class="m-soft">{{ page + 1 }} / {{ pages.toLocaleString() }}</span>
      <button :disabled="page + 1 >= pages" @click="push({ page: page + 1 })">Next</button>
    </nav>
    <p class="m-soft m-note">Gap = Google rating − filtered score. Positive means Google looks inflated.</p>
  </template>
</template>
