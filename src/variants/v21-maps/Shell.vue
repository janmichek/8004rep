<script setup lang="ts">
import { useRouter } from 'vue-router'
import { CITIES } from '../../places/catalog'
import { TOTAL_PLACES } from '../../places/source'
import { useRouteCity } from './use'

const { route, slug, known } = useRouteCity()
const router = useRouter()

function go(value: string): void {
  void router.push({ name: route.name === 'network' ? 'network' : 'agents', params: { slug: value } })
}
</script>

<template>
  <div class="m-wrap">
    <header class="m-top">
      <RouterLink class="m-brand" :to="{ name: 'agents', params: { slug } }">Place<span>rep</span></RouterLink>
      <nav>
        <RouterLink :to="{ name: 'agents', params: { slug } }" :class="{ on: route.name === 'agents' }">Places</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug } }" :class="{ on: route.name === 'network' }">Overview</RouterLink>
      </nav>
      <label class="m-city">
        <span class="m-label">City</span>
        <select :value="slug" @change="go(($event.target as HTMLSelectElement).value)">
          <option value="all">All cities</option>
          <option v-for="c in CITIES" :key="c.slug" :value="c.slug">{{ c.name }}</option>
        </select>
      </label>
    </header>
    <main>
      <section v-if="!known" class="m-state">
        <h1>Unknown city “{{ slug }}”</h1>
        <RouterLink :to="{ name: 'agents', params: { slug: 'all' } }">All cities</RouterLink>
      </section>
      <RouterView v-else :key="route.path" />
    </main>
    <footer>
      {{ TOTAL_PLACES.toLocaleString() }} generated places in the shape of the Google Places API (New). Sample data, not real businesses.
    </footer>
  </div>
</template>
