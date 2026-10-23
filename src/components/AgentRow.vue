<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChainInfo } from '../chains'
import { resolveAgentURI } from '../data/metadata'
import type { AgentSummary, RegistrationFile, ReputationSummary } from '../data/types'
import { formatDate, formatScore, shortAddress } from '../format'
import AgentAvatar from './AgentAvatar.vue'

const props = defineProps<{
  agent: AgentSummary
  chain: ChainInfo
  /** On-chain count and average; absent while it loads or if the read failed. */
  score?: ReputationSummary
  /** Scores for this page are still being read. */
  scoreLoading?: boolean
  /** Owner page already is that address; the column would only repeat it. */
  hideOwner?: boolean
  /** Kept at the top of the list by hand. */
  bookmarked?: boolean
}>()

// undefined while the registration file is being fetched.
const file = ref<RegistrationFile | null>()

watch(
  () => props.agent,
  async (agent) => {
    file.value = agent.file
    if (agent.file !== undefined) return
    const resolved = await resolveAgentURI(agent.agentURI)
    if (props.agent === agent) file.value = resolved
  },
  { immediate: true },
)

const name = computed(() => file.value?.name ?? `Agent #${props.agent.tokenId}`)
const feedbackLabel = computed(() => {
  const score = props.score
  if (!score) return undefined
  if (score.count === 0) return '0'
  const count = `${score.capped ? '≥' : ''}${score.count}`
  return `${count} · avg ${formatScore(score.average)}`
})
const to = computed(() => ({
  name: 'agent',
  params: { slug: props.chain.slug, id: props.agent.tokenId.toString() },
}))
</script>

<template>
  <tr>
    <td>
      <div class="agent-cell">
        <AgentAvatar :pending="file === undefined" :image="file?.image" :label="file?.name ?? ''" />
        <div class="agent-name">
          <template v-if="file === undefined">
            <span class="muted">Loading…</span>
          </template>
          <template v-else>
            <RouterLink :to="to">
              <svg
                v-if="bookmarked"
                class="bookmark"
                viewBox="0 0 24 24"
                fill="currentColor"
                role="img"
                aria-label="Pinned"
              >
                <path d="M6 3.75A1.75 1.75 0 0 1 7.75 2h8.5A1.75 1.75 0 0 1 18 3.75V21l-6-4.25L6 21V3.75Z" />
              </svg>
              {{ name }}
            </RouterLink>
            <small v-if="file?.description">{{ file.description }}</small>
            <small v-else-if="file === null" class="muted">
              {{ agent.agentURI ? 'metadata unreachable' : 'no metadata URI' }}
            </small>
          </template>
        </div>
      </div>
    </td>
    <td class="num">
      <RouterLink :to="to">#{{ agent.tokenId }}</RouterLink>
    </td>
    <td v-if="!hideOwner">
      <RouterLink v-if="agent.owner" :to="{ name: 'owner', params: { slug: chain.slug, address: agent.owner } }" class="mono" :title="agent.owner">
        {{ shortAddress(agent.owner) }}
      </RouterLink>
      <span v-else class="muted">—</span>
    </td>
    <td class="num" :title="score?.capped ? 'Count and average of the first 200 clients' : undefined">
      <span v-if="scoreLoading" class="muted">…</span>
      <template v-else-if="feedbackLabel">{{ feedbackLabel }}</template>
      <span v-else class="muted">—</span>
    </td>
    <td class="num">{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</td>
  </tr>
</template>
