<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { CHAINS } from '../chains'
import type { ScanAgent } from '../data/scan'
import { formatDate, formatScore, formatTimeline, shortAddress } from '../format'
import AgentAvatar from './AgentAvatar.vue'
import ChainIcon from './ChainIcon.vue'

const props = defineProps<{ agent: ScanAgent; chainName?: string; chainKey?: string }>()

const router = useRouter()

const known = computed(() => CHAINS.find((chain) => chain.chainId === props.agent.chainId))
const name = computed(() => props.agent.name || `Agent #${props.agent.tokenId}`)
const services = computed(() => props.agent.protocols.map((protocol) => protocol.toUpperCase()))
const serviceLabels = computed(() => [...services.value, ...(props.agent.x402 ? ['X402'] : [])])
const score = computed(() => Math.max(0, Math.min(100, props.agent.totalScore)))
const scoreLabel = computed(() => formatScore(Math.round(props.agent.totalScore * 10) / 10))
const createdAt = computed(() => (props.agent.createdAt ? formatTimeline(props.agent.createdAt) : '—'))
const createdTitle = computed(() => (props.agent.createdAt ? formatDate(props.agent.createdAt) : undefined))
const externalUrl = computed(() => `https://8004scan.io/agents/${props.chainKey ?? props.agent.chainId}/${props.agent.tokenId}`)

function open(): void {
  if (known.value) {
    void router.push({ name: 'agent', params: { slug: known.value.slug, id: props.agent.tokenId.toString() } })
  } else if (router.hasRoute('scan-agent')) {
    void router.push({ name: 'scan-agent', params: { chainId: props.agent.chainId.toString(), id: props.agent.tokenId.toString() } })
  } else {
    window.open(externalUrl.value, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <tr
    class="row-link"
    role="link"
    tabindex="0"
    :aria-label="`Open ${name}`"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <td>
      <div class="agent-cell">
        <AgentAvatar :image="agent.imageUrl" :label="name" :seed="`${agent.chainId}:${agent.tokenId}`" />
        <div class="agent-name">
          <span class="agent-title">{{ name }}</span>
          <small v-if="agent.description">{{ agent.description }}</small>
        </div>
      </div>
    </td>
    <td class="num">#{{ agent.tokenId }}</td>
    <td>
      <span class="chain-cell">
        <ChainIcon :chain-id="agent.chainId" :name="chainName" :size="14" />
        <span class="chain-name" :title="chainName">{{ chainName ?? `Chain ${agent.chainId}` }}</span>
      </span>
    </td>
    <td class="services-td">
      <span v-if="serviceLabels.length" class="services-cell">
        <span class="services-clip">
          <span v-for="service in services" :key="service" class="chip">{{ service }}</span>
          <span v-if="agent.x402" class="chip accent">X402</span>
        </span>
        <span class="services-pop" role="tooltip">
          <span v-for="service in services" :key="service" class="chip">{{ service }}</span>
          <span v-if="agent.x402" class="chip accent">X402</span>
        </span>
      </span>
      <span v-else class="muted">—</span>
    </td>
    <td class="score-cell">
      <span class="score-label">{{ scoreLabel }}</span>
      <span class="score-track" aria-hidden="true">
        <span class="score-fill" :style="{ width: `${score}%` }" />
      </span>
    </td>
    <td class="num">{{ agent.feedbackCount }}</td>
    <td>
      <span v-if="agent.owner" class="mono" :title="agent.owner">{{ shortAddress(agent.owner) }}</span>
      <span v-else class="muted">—</span>
    </td>
    <td class="num" :title="createdTitle">{{ createdAt }}</td>
  </tr>
</template>
