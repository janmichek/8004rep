<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, formatNumber, formatPercent } from '../../format'
import { byDay, labelsText } from '../shared/metrics'
import { routes, useChain, useNetwork } from '../shared/use'
import Post from './Post.vue'

const props = defineProps<{ slug: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { feed, error, loading, load, stats, ecosystem } = useNetwork(chain)
const days = computed(() => byDay(feed.value?.items ?? []))
// Trending: most reviews in the newest 24h of the window.
const trending = computed(() => {
  const items = feed.value?.items ?? []
  const newest = items[0]?.createdAt
  if (newest === undefined) return []
  const by = new Map<string, { tokenId: bigint; name?: string; n: number }>()
  for (const r of items) {
    if (r.createdAt === undefined || newest - r.createdAt > 86400) continue
    const e = by.get(String(r.tokenId)) ?? { tokenId: r.tokenId, name: r.agentName, n: 0 }
    e.n++
    by.set(String(r.tokenId), e)
  }
  return [...by.values()].sort((a, b) => b.n - a.n).slice(0, 6)
})
function dayLabel(day: number | null): string {
  if (day === null) return 'Undated'
  const today = Math.floor(Date.now() / 86400000) * 86400
  return day === today ? 'Today' : day === today - 86400 ? 'Yesterday' : formatDate(day)
}
</script>

<template>
  <main class="s-main">
    <header class="s-head">
      <h1>Home</h1>
      <p>Latest reviews on {{ chain.name }}<template v-if="stats"> · {{ stats.rows }} posts from {{ stats.reviewers }} accounts</template></p>
    </header>
    <p v-if="error" class="s-empty">Couldn't load posts: {{ error }} <button @click="load()">Retry</button></p>
    <p v-else-if="!feed" class="s-empty">Loading your timeline…</p>
    <template v-else>
      <template v-for="d in days" :key="d.day ?? 'none'">
        <div class="s-day">{{ dayLabel(d.day) }} · {{ d.rows.length }}</div>
        <Post
          v-for="(r, i) in d.rows"
          :key="`${r.client}${r.tokenId}${r.index}${i}`"
          :row="r"
          :chain="chain"
          :author="to.reviewer(r.client)"
          :subject="{ name: r.agentName ?? `#${r.tokenId}`, to: to.agent(r.tokenId) }"
          @verify="$router.push(to.agent(r.tokenId))"
        />
      </template>
      <button v-if="feed.cursor" class="s-more" :disabled="loading" @click="load(true)">{{ loading ? 'Loading…' : 'Show older posts' }}</button>
      <p v-else class="s-empty">You're all caught up.</p>
    </template>
  </main>
  <aside class="s-right">
    <div v-if="stats" class="s-box">
      <h2>Pulse</h2>
      <p style="margin: 0">Average <b>{{ formatNumber(stats.average) }}</b><span class="soft"> · eco {{ formatNumber(ecosystem.data.value?.averageFeedback) }}</span></p>
      <p style="margin: 4px 0 0">Perfect 100s <b :style="{ color: (stats.perfectShare ?? 0) > 0.7 ? '#f91880' : '' }">{{ formatPercent(stats.perfectShare) }}</b></p>
      <p style="margin: 4px 0 0">{{ stats.agents }} agents · {{ stats.revoked }} deleted</p>
    </div>
    <div v-if="trending.length" class="s-box">
      <h2>Trending today</h2>
      <RouterLink v-for="(t, i) in trending" :key="t.tokenId.toString()" :to="to.agent(t.tokenId)" class="s-trend">
        <small>{{ i + 1 }} · Trending on {{ chain.shortName }}</small><b>{{ t.name ?? `Agent #${t.tokenId}` }}</b><small>{{ t.n }} reviews</small>
      </RouterLink>
    </div>
    <div v-if="stats" class="s-box">
      <h2>Accounts to watch</h2>
      <p v-if="!stats.suspects.length" class="soft">Nobody suspicious right now.</p>
      <RouterLink v-for="s in stats.suspects.slice(0, 6)" :key="s.client" :to="to.reviewer(s.client)" class="s-trend">
        <b class="mono">{{ s.client.slice(0, 10) }}…</b><small>{{ labelsText(s.labels) }} · {{ s.rows }} posts</small>
      </RouterLink>
    </div>
    <div v-if="stats?.lookalikes.length" class="s-box">
      <h2>Same crowd</h2>
      <p v-for="(g, i) in stats.lookalikes.slice(0, 4)" :key="i" style="margin: 0 0 8px; font-size: 14px">
        <RouterLink v-for="a in g.agents" :key="a.tokenId.toString()" :to="to.agent(a.tokenId)" class="s-badge">{{ a.agentName ?? `#${a.tokenId}` }}</RouterLink>
        <span class="soft">{{ g.reviewers.length }} shared followers</span>
      </p>
    </div>
  </aside>
</template>
