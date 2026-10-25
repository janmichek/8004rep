<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BookmarkButton from '../bookmarks/BookmarkButton.vue'
import { addressExplorerUrl, agentScanUrl, findChainBySlug } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import AgentAvatar from '../components/AgentAvatar.vue'
import ChainIcon from '../components/ChainIcon.vue'
import ChainName from '../components/ChainName.vue'
import ReputationPanel from '../components/reputation/ReputationPanel.vue'
import Disclosure from '../components/ui/Disclosure.vue'
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
const rawJson = computed(() => (file.value ? JSON.stringify(file.value.raw, null, 2) : undefined))
</script>

<template>

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
    <div class="tabbar" aria-hidden="true">
      <Skeleton v-for="n in 4" :key="n" width="6.5em" height="1.35em" />
    </div>
  </section>
  <section v-else-if="agent === null" class="state">
    <h1>Agent #{{ id }} not found</h1>
    <p class="muted">No such token in the <ChainName :chain-id="chain.chainId" :name="chain.name" /> identity registry.</p>
  </section>

  <template v-else>
    <div class="agent-head">
      <AgentAvatar class="large" :pending="file === undefined" :image="file?.image" :label="file?.name ?? ''" :seed="`${chain.chainId}:${agent.tokenId}`" />
      <div>
        <h1>
          <Skeleton v-if="file === undefined" width="12em" height="1.2em" />
          <template v-else>{{ name }}</template>
        </h1>
        <p class="meta">
          <span class="mono"><ChainIcon :chain-id="chain.chainId" :name="chain.name" :size="13" /> {{ chain.chainId }}:{{ agent.tokenId }}</span>
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
          <BookmarkButton :chain-id="chain.chainId" :token-id="agent.tokenId" :testnet="chain.testnet" />
          <a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a>
        </p>
      </div>
    </div>

    <ReputationPanel :agent="agent" :chain="chain" :file="file">
      <template #overview-top>
        <div v-if="file === undefined" class="skeleton-stack description" aria-busy="true">
          <span class="sr-only">Loading registration file</span>
          <Skeleton block width="88%" />
          <Skeleton block width="64%" />
        </div>
        <p v-else-if="file?.description" class="description">{{ file.description }}</p>
        <p v-else-if="file === null" class="notice">
          {{
            agent.agentURI
              ? 'The registration file could not be loaded (unreachable host, blocked by CORS, or not JSON). On-chain data is on the Identity tab.'
              : 'This agent has no metadata URI set. On-chain data is on the Identity tab.'
          }}
        </p>
      </template>

      <template #identity>
        <div class="facts">
          <section class="panel">
            <h3>Identity</h3>
            <dl>
              <dt>Owner</dt>
              <dd>
                <RouterLink
                  v-if="agent.owner"
                  :to="{ name: 'owner', params: { slug: chain.slug, address: agent.owner } }"
                  class="address-mark mono"
                  :title="agent.owner"
                >
                  <AddressIdenticon :address="agent.owner" />
                  {{ shortAddress(agent.owner) }}
                </RouterLink>
                <span v-else class="muted">—</span>
              </dd>
              <dt>Agent wallet</dt>
              <dd>
                <a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer" class="address-mark mono" :title="agent.agentWallet">
                  <AddressIdenticon :address="agent.agentWallet" />
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

        <Disclosure v-if="rawJson" label="Raw registration file">
          <pre>{{ rawJson }}</pre>
        </Disclosure>
      </template>
    </ReputationPanel>
  </template>
</template>
