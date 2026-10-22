<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addressExplorerUrl, agentScanUrl, findChainBySlug } from '../chains'
import AgentAvatar from '../components/AgentAvatar.vue'
import ReputationPanel from '../components/reputation/ReputationPanel.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import { sourceFor } from '../data'
import { resolveAgentURI, toDisplayUrl } from '../data/metadata'
import type { RegistrationFile } from '../data/types'
import { formatDate, shortAddress } from '../format'
import { useAsync } from '../useAsync'

const props = defineProps<{ slug: string; id: string }>()

// App.vue only renders this page for a known slug.
const chain = computed(() => findChainBySlug(props.slug)!)
const tokenId = computed(() => (/^\d+$/.test(props.id) ? BigInt(props.id) : undefined))

const { data: agent, error, loading, reload } = useAsync(
  async () => {
    if (tokenId.value === undefined) return null
    const { source } = await sourceFor(chain.value)
    return source.getAgent(tokenId.value)
  },
  () => [chain.value, tokenId.value],
)

// The on-chain record shows first; the registration file follows when its host answers.
// undefined while it is being fetched.
const file = ref<RegistrationFile | null>()
watch(agent, async (current) => {
  file.value = undefined
  if (!current) return
  // Prefer the real file over the indexer's partial copy of it.
  const resolved = (await resolveAgentURI(current.agentURI)) ?? current.file ?? null
  if (agent.value === current) file.value = resolved
})

const name = computed(() => file.value?.name ?? `Agent #${props.id}`)
const uriLink = computed(() => {
  const uri = agent.value?.agentURI
  return uri && !/^data:/i.test(uri) ? toDisplayUrl(uri) : undefined
})
</script>

<template>
  <p class="crumbs">
    <RouterLink :to="{ name: 'agents', params: { slug: chain.slug } }">← {{ chain.name }} agents</RouterLink>
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
    <div class="skeleton-stack description">
      <Skeleton block width="92%" />
      <Skeleton block width="68%" />
    </div>
    <div class="facts">
      <section v-for="panel in 2" :key="panel" class="panel">
        <Skeleton width="6em" height="0.9em" />
        <div class="skeleton-stack">
          <Skeleton v-for="line in 4" :key="line" block height="1.15em" :width="line % 2 ? '100%' : '84%'" />
        </div>
      </section>
    </div>
  </section>
  <section v-else-if="agent === null" class="state">
    <h1>Agent #{{ id }} not found</h1>
    <p class="muted">No such token in the {{ chain.name }} identity registry.</p>
  </section>

  <template v-else>
    <div class="agent-head">
      <AgentAvatar class="large" :pending="file === undefined" :image="file?.image" :label="file?.name ?? ''" />
      <div>
        <h1>
          <Skeleton v-if="file === undefined" width="12em" height="1.2em" />
          <template v-else>{{ name }}</template>
        </h1>
        <p class="meta">
          <span class="mono">{{ chain.chainId }}:{{ agent.tokenId }}</span>
          <template v-if="file === undefined">
            <Skeleton width="4.2em" height="1.35em" radius="999px" />
            <Skeleton width="3.2em" height="1.35em" radius="999px" />
          </template>
          <template v-else>
            <span v-if="file?.active === true" class="chip ok">active</span>
            <span v-else-if="file?.active === false" class="chip">inactive</span>
            <span v-if="file?.x402Support" class="chip accent">x402</span>
            <span v-for="trust in file?.supportedTrust ?? []" :key="trust" class="chip">{{ trust }}</span>
          </template>
          <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">View on 8004scan ↗</a>
        </p>
      </div>
    </div>

    <div v-if="file === undefined" class="skeleton-stack description" aria-busy="true">
      <span class="sr-only">Loading registration file</span>
      <Skeleton block width="88%" />
      <Skeleton block width="64%" />
    </div>
    <p v-else-if="file?.description" class="description">{{ file.description }}</p>
    <p v-else-if="file === null" class="notice">
      {{
        agent.agentURI
          ? 'The registration file could not be loaded (unreachable host, blocked by CORS, or not JSON). On-chain data is shown below.'
          : 'This agent has no metadata URI set. On-chain data is shown below.'
      }}
    </p>

    <div class="facts">
      <section class="panel">
        <h3>Identity</h3>
        <dl>
          <dt>Owner</dt>
          <dd>
            <RouterLink
              v-if="agent.owner"
              :to="{ name: 'owner', params: { slug: chain.slug, address: agent.owner } }"
              class="mono"
              :title="agent.owner"
            >
              {{ shortAddress(agent.owner) }}
            </RouterLink>
            <span v-else class="muted">—</span>
          </dd>
          <dt>Agent wallet</dt>
          <dd>
            <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="mono" :title="agent.agentWallet">
              {{ shortAddress(agent.agentWallet) }}
            </a>
            <span v-else class="muted">not set</span>
            <small v-if="agent.agentWallet && agent.owner && agent.agentWallet.toLowerCase() === agent.owner.toLowerCase()" class="muted"> same as owner</small>
          </dd>
          <dt>Agent URI</dt>
          <dd>
            <a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer" class="mono ellipsis" :title="agent.agentURI ?? ''">{{ agent.agentURI }}</a>
            <span v-else-if="agent.agentURI" class="mono ellipsis" :title="agent.agentURI">{{ agent.agentURI }}</span>
            <span v-else class="muted">not set</span>
          </dd>
          <dt>Registry</dt>
          <dd>
            <a :href="addressExplorerUrl(chain, chain.identity)" target="_blank" rel="noopener noreferrer" class="mono" :title="chain.identity">
              {{ shortAddress(chain.identity) }}
            </a>
          </dd>
          <template v-if="agent.createdAt">
            <dt>Registered</dt>
            <dd>{{ formatDate(agent.createdAt) }}</dd>
          </template>
        </dl>
      </section>

      <section class="panel">
        <h3>Services</h3>
        <div v-if="file === undefined" class="skeleton-stack" aria-busy="true">
          <span class="sr-only">Loading registration file</span>
          <Skeleton block height="1.15em" />
          <Skeleton block height="1.15em" width="76%" />
        </div>
        <p v-else-if="!file?.services?.length" class="muted">No services advertised.</p>
        <dl v-else>
          <template v-for="service in file.services" :key="service.name + service.endpoint">
            <dt><span class="chip">{{ service.name }}</span></dt>
            <dd>
              <a v-if="toDisplayUrl(service.endpoint)" :href="toDisplayUrl(service.endpoint)" target="_blank" rel="noopener noreferrer" class="ellipsis" :title="service.endpoint">
                {{ service.endpoint }}
              </a>
              <span v-else class="ellipsis" :title="service.endpoint">{{ service.endpoint }}</span>
              <small v-if="service.version" class="muted"> v{{ service.version }}</small>
            </dd>
          </template>
        </dl>
      </section>
    </div>

    <ReputationPanel :agent="agent" :chain="chain" :file="file" />
  </template>
</template>
