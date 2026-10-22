<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ChainInfo } from '../chains'
import { resolveAgentURI } from '../data/metadata'
import type { AgentSummary, RegistrationFile, ReputationSummary } from '../data/types'
import { formatDate, formatScore, shortAddress } from '../format'
import AgentAvatar from './AgentAvatar.vue'
import Skeleton from './ui/Skeleton.vue'

const props = defineProps<{
  agent: AgentSummary
  chain: ChainInfo
  /** On-chain count and average; absent while it loads or if the read failed. */
  score?: ReputationSummary
  /** Scores for this page are still being read. */
  scoreLoading?: boolean
  /** Owner page already is that address; the column would only repeat it. */
  hideOwner?: boolean
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
        <AgentAvatar :pending="file === undefined" :image="file?.image" :label="file?.name ?? ''" :seed="`${chain.chainId}:${agent.tokenId}`" />
        <div class="agent-name">
          <template v-if="file === undefined">
            <Skeleton width="9em" />
            <Skeleton width="14em" height="0.65em" />
          </template>
          <template v-else>
            <RouterLink :to="to">{{ name }}</RouterLink>
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
    <td>
      <template v-if="file === undefined">
        <Skeleton width="3.2em" height="1.35em" radius="999px" />
      </template>
      <template v-else>
        <span v-for="service in file?.services ?? []" :key="service.name + service.endpoint" class="chip">
          {{ service.name }}
        </span>
        <span v-if="file?.x402Support" class="chip accent">x402</span>
      </template>
    </td>
    <td class="num" :title="score?.capped ? 'Count and average of the first 200 clients' : undefined">
      <Skeleton v-if="scoreLoading" width="5.5em" />
      <template v-else-if="feedbackLabel">{{ feedbackLabel }}</template>
      <span v-else class="muted">—</span>
    </td>
    <td class="num">{{ agent.createdAt ? formatDate(agent.createdAt) : '—' }}</td>
  </tr>
</template>
