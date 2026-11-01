<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Address } from 'viem'
import { CHAINS } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import AgentAvatar from '../components/AgentAvatar.vue'
import ChainName from '../components/ChainName.vue'
import { sourceFor } from '../data'
import { fetchScanAgentDetail } from '../data/scan'
import { formatScore, shortAddress } from '../format'
import { starKey, starred, toggleStar, type Star, type StarKind } from '../stars'

const GROUPS: { kind: StarKind; title: string }[] = [
  { kind: 'agent', title: 'Agents' },
  { kind: 'owner', title: 'Owners' },
  { kind: 'reviewer', title: 'Reviewers' },
]

const groups = computed(() =>
  GROUPS.map((group) => ({ ...group, rows: starred.value.filter((star) => star.kind === group.kind) })),
)

function chainOf(chainId: number) {
  return CHAINS.find((chain) => chain.chainId === chainId)
}

/** Agents on unconfigured chains open from 8004scan, like the classic agent page does. */
function linkFor(star: Star) {
  const chain = chainOf(star.chainId)
  if (star.kind === 'agent') {
    return chain
      ? { name: 'agent', params: { slug: chain.slug, id: star.id } }
      : { name: 'scan-agent', params: { chainId: String(star.chainId), id: star.id } }
  }
  if (!chain) return undefined
  return { name: star.kind, params: { slug: chain.slug, address: star.id } }
}

function nameOf(star: Star): string {
  if (star.kind === 'agent') return star.label || `Agent #${star.id}`
  return star.label || shortAddress(star.id)
}

function remove(star: Star): void {
  toggleStar(star)
}

/**
 * Basic stats per star, fetched once per star and kept for this visit.
 * Agents: score and feedback count from 8004scan. Owners: agents owned.
 * Reviewers have no stat: counting their feedback means paging their whole history.
 */
const stats = ref<Record<string, string>>({})
const pending = new Set<string>()

async function statFor(star: Star): Promise<string | undefined> {
  if (star.kind === 'agent') {
    const detail = await fetchScanAgentDetail(star.chainId, BigInt(star.id)).catch(() => null)
    if (!detail) return '—'
    const score = formatScore(Math.round(detail.totalScore * 10) / 10)
    return `Score ${score} · ${detail.feedbackCount} feedback`
  }
  if (star.kind === 'owner') {
    const chain = chainOf(star.chainId)
    if (!chain) return undefined
    const { source } = await sourceFor(chain)
    const page = await source.listAgents({ page: 0, pageSize: 1, owner: star.id as Address }).catch(() => null)
    if (!page) return '—'
    return page.total === undefined ? undefined : `${page.total} ${page.total === 1 ? 'agent' : 'agents'}`
  }
  return undefined
}

watch(
  starred,
  (list) => {
    for (const star of list) {
      const key = starKey(star.kind, star.chainId, star.id)
      if (star.kind === 'reviewer' || key in stats.value || pending.has(key)) continue
      pending.add(key)
      void statFor(star)
        .catch(() => '—')
        .then((text) => {
          if (text !== undefined) stats.value = { ...stats.value, [key]: text }
        })
        .finally(() => pending.delete(key))
    }
  },
  { immediate: true },
)

function statOf(star: Star): string {
  return stats.value[starKey(star.kind, star.chainId, star.id)] ?? '…'
}
</script>

<template>
  <div class="page-head">
    <h1>
      Starred
      <small>{{ starred.length }} starred</small>
    </h1>
    <p class="meta">Kept in this browser only.</p>
  </div>

  <section v-if="starred.length === 0" class="state muted">
    Nothing starred yet. Use “Star” on an agent, owner or reviewer page.
  </section>

  <template v-else>
    <section v-for="group in groups.filter((g) => g.rows.length)" :key="group.kind" class="starred-group">
      <h2>{{ group.title }} <small class="muted">{{ group.rows.length }}</small></h2>
      <ul class="starred-list">
        <li v-for="star in group.rows" :key="`${star.kind}:${star.chainId}:${star.id}`">
          <span class="starred-icon">
            <AgentAvatar
              v-if="star.kind === 'agent'"
              :image="star.image"
              :label="nameOf(star)"
              :seed="`${star.chainId}:${star.id}`"
            />
            <AddressIdenticon v-else :address="star.id" :size="28" />
          </span>
          <RouterLink v-if="linkFor(star)" :to="linkFor(star)!" class="starred-name">{{ nameOf(star) }}</RouterLink>
          <span v-else class="starred-name">{{ nameOf(star) }}</span>
          <span class="starred-chain">
            <ChainName v-if="chainOf(star.chainId)" :chain-id="star.chainId" :name="chainOf(star.chainId)!.name" />
            <span v-else class="mono">{{ star.chainId }}</span>
          </span>
          <span v-if="star.kind !== 'reviewer'" class="starred-stat">{{ statOf(star) }}</span>
          <button type="button" class="filter-toggle" @click="remove(star)">Remove</button>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.starred-group {
  margin-top: 24px;
}

.starred-group h2 {
  font-size: 1rem;
}

.starred-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.starred-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}

.starred-icon {
  flex: none;
  display: inline-flex;
  width: 28px;
  height: 28px;
}

.starred-icon :deep(.avatar) {
  width: 28px;
  height: 28px;
}

.starred-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.starred-chain {
  color: var(--muted);
  font-size: 0.9em;
}

.starred-stat {
  min-width: 9em;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.85em;
  text-align: right;
}
</style>
