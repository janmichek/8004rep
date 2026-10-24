<script setup lang="ts">
import { computed } from 'vue'
import { DEFAULT_CHAIN } from '../chains'
import AgentAvatar from '../components/AgentAvatar.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import { fetchScanAgentDetail, fetchScanChains } from '../data/scan'
import { formatDate, formatNumber, formatScore, shortAddress } from '../format'
import { useAsync } from '../useAsync'

// Agents on networks 8004rep has no chain config for: 8004scan's index is the record.
const props = defineProps<{ chainId: string; id: string }>()

const chainId = computed(() => (Number.isInteger(Number(props.chainId)) ? Number(props.chainId) : undefined))
const tokenId = computed(() => (/^\d+$/.test(props.id) ? BigInt(props.id) : undefined))

const { data: chains } = useAsync(fetchScanChains, () => true)
const network = computed(() => chains.value?.find((chain) => chain.chainId === chainId.value))

const { data: agent, error, loading, reload } = useAsync(
  async () => {
    if (chainId.value === undefined || tokenId.value === undefined) return null
    return fetchScanAgentDetail(chainId.value, tokenId.value)
  },
  () => [chainId.value, tokenId.value],
)

const name = computed(() => agent.value?.name ?? `Agent #${props.id}`)
const scanUrl = computed(() => {
  const host = network.value?.testnet ? 'https://testnet.8004scan.io' : 'https://8004scan.io'
  return `${host}/agents/${network.value?.key ?? chainId.value}/${props.id}`
})
</script>

<template>
  <p class="crumbs">
    <RouterLink :to="{ name: 'agents', params: { slug: DEFAULT_CHAIN.slug }, query: { chain: props.chainId } }">← Agents</RouterLink>
  </p>

  <section v-if="error" class="state">
    <p>Could not load agent: {{ error }}</p>
    <button @click="reload">Retry</button>
  </section>
  <section v-else-if="loading || agent === undefined" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading agent</span>
    <div class="agent-head">
      <Skeleton width="64px" height="64px" radius="14px" />
      <div class="skeleton-stack">
        <Skeleton width="14em" height="1.35em" />
        <Skeleton width="22em" height="0.8em" />
      </div>
    </div>
  </section>
  <section v-else-if="agent === null" class="state">
    <h1>Agent #{{ id }} not found</h1>
    <p class="muted">8004scan has no record of this agent.</p>
  </section>

  <template v-else>
    <div class="agent-head">
      <AgentAvatar class="large" :image="agent.imageUrl" :label="name" :seed="`${agent.chainId}:${agent.tokenId}`" />
      <div>
        <h1>{{ name }}</h1>
        <p class="meta">
          <span class="mono">{{ agent.chainId }}:{{ agent.tokenId }}</span>
          <span v-if="agent.active === true" class="chip ok">active</span>
          <span v-else-if="agent.active === false" class="chip">inactive</span>
          <span v-if="agent.x402" class="chip accent">x402</span>
          <span v-for="protocol in agent.protocols" :key="protocol" class="chip">{{ protocol }}</span>
          <a :href="scanUrl" target="_blank" rel="noopener noreferrer">View on 8004scan ↗</a>
        </p>
      </div>
    </div>

    <p v-if="agent.description" class="description">{{ agent.description }}</p>

    <p class="notice">
      {{ network?.name ?? `Chain ${agent.chainId}` }} is not configured for on-chain reads in 8004rep yet, so this
      record comes from 8004scan's index.
    </p>

    <div class="facts">
      <section class="panel">
        <h3>Identity</h3>
        <dl>
          <dt>Owner</dt>
          <dd>
            <span v-if="agent.owner" class="mono" :title="agent.owner">{{ shortAddress(agent.owner) }}</span>
            <span v-else class="muted">—</span>
          </dd>
          <dt>Agent wallet</dt>
          <dd>
            <span v-if="agent.agentWallet" class="mono" :title="agent.agentWallet">{{ shortAddress(agent.agentWallet) }}</span>
            <span v-else class="muted">not set</span>
          </dd>
          <template v-if="agent.createdAt">
            <dt>Registered</dt>
            <dd>{{ formatDate(agent.createdAt) }}</dd>
          </template>
          <template v-if="agent.supportedTrust.length">
            <dt>Trust models</dt>
            <dd>
              <span v-for="trust in agent.supportedTrust" :key="trust" class="chip">{{ trust }}</span>
            </dd>
          </template>
        </dl>
      </section>

      <section class="panel">
        <h3>Services</h3>
        <p v-if="!agent.services.length" class="muted">No services advertised.</p>
        <dl v-else>
          <template v-for="service in agent.services" :key="service.name + service.endpoint">
            <dt><span class="chip">{{ service.name }}</span></dt>
            <dd>
              <a :href="service.endpoint" target="_blank" rel="noopener noreferrer" class="ellipsis" :title="service.endpoint">
                {{ service.endpoint }}
              </a>
              <small v-if="service.version" class="muted"> v{{ service.version }}</small>
            </dd>
          </template>
        </dl>
      </section>
    </div>

    <section class="panel">
      <h3>Reputation</h3>
      <dl>
        <dt>8004scan score</dt>
        <dd>{{ formatNumber(agent.totalScore) }}</dd>
        <dt>Average feedback</dt>
        <dd>{{ agent.feedbackCount ? formatScore(agent.averageScore) : '—' }}</dd>
        <dt>Feedback</dt>
        <dd>{{ formatNumber(agent.feedbackCount, 0) }}</dd>
      </dl>
    </section>
  </template>
</template>
