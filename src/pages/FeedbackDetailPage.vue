<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addressExplorerUrl, findChainBySlug, txExplorerUrl } from '../chains'
import FeedbackNote from '../components/FeedbackNote.vue'
import ChainIcon from '../components/ChainIcon.vue'
import ChainName from '../components/ChainName.vue'
import TxDetail from '../components/TxDetail.vue'
import Skeleton from '../components/ui/Skeleton.vue'
import { sourceFor } from '../data'
import { computeFeedbackStats } from '../data/feedbackStats'
import { resolveAgentURI, toDisplayUrl } from '../data/metadata'
import type { RegistrationFile } from '../data/types'
import { formatDate, formatScore, formatTimeline, shortAddress } from '../format'
import { useAsync } from '../useAsync'

const props = defineProps<{ slug: string; id: string; index: string }>()

const chain = computed(() => findChainBySlug(props.slug)!)
const tokenId = computed(() => (/^\d+$/.test(props.id) ? BigInt(props.id) : undefined))
const rowIndex = computed(() => (/^\d+$/.test(props.index) ? Number(props.index) : undefined))

const { data: agent, error, loading, reload } = useAsync(
  async () => {
    if (tokenId.value === undefined) return null
    const { source } = await sourceFor(chain.value)
    return source.getAgent(tokenId.value)
  },
  () => [chain.value, tokenId.value],
)

const file = ref<RegistrationFile | null>()
watch(agent, async (current) => {
  file.value = undefined
  if (!current) return
  const resolved = (await resolveAgentURI(current.agentURI)) ?? current.file ?? null
  if (agent.value === current) file.value = resolved
})

const row = computed(() => (rowIndex.value === undefined ? undefined : agent.value?.feedback[rowIndex.value]))
const stats = computed(() =>
  agent.value
    ? computeFeedbackStats(agent.value.feedback, {
        owner: agent.value.owner,
        agentWallet: agent.value.agentWallet,
        ...(file.value ? { services: file.value.services.map((s) => s.endpoint) } : {}),
      })
    : undefined,
)
const name = computed(() => file.value?.name ?? `Agent #${props.id}`)

function evidenceUrl(uri: string | undefined): string | undefined {
  return uri && !/^data:/i.test(uri) ? toDisplayUrl(uri) : undefined
}
</script>

<template>
  <p class="crumbs">
    <RouterLink :to="{ name: 'agent', params: { slug, id }, query: { tab: 'feedback' } }">← {{ loading ? 'Back' : name }} feedback</RouterLink>
  </p>

  <section v-if="error" class="state">
    <p>Could not load feedback: {{ error }}</p>
    <button @click="reload">Retry</button>
  </section>
  <section v-else-if="loading || agent === undefined" class="state" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading feedback</span>
    <div class="skeleton-stack">
      <Skeleton width="18em" height="1.35em" />
      <Skeleton width="28em" height="0.9em" />
      <Skeleton block width="92%" height="9em" />
    </div>
  </section>
  <section v-else-if="agent === null" class="state">
    <h1>Agent #{{ id }} not found</h1>
    <p class="muted">No such token in the <ChainName :chain-id="chain.chainId" :name="chain.name" /> identity registry.</p>
  </section>
  <section v-else-if="!row" class="state">
    <h1>Feedback row not found</h1>
    <p class="muted">Agent #{{ id }} has no feedback at index {{ index }}.</p>
  </section>

  <template v-else>
    <h1>Feedback detail</h1>
    <p class="meta">
      <RouterLink :to="{ name: 'agent', params: { slug, id } }">{{ name }}</RouterLink>
      <span class="mono"><ChainIcon :chain-id="chain.chainId" :name="chain.name" :size="13" /> {{ chain.chainId }}:{{ agent.tokenId }}</span>
      <span v-if="row.index !== undefined" class="muted">review #{{ row.index }}</span>
      <span v-if="row.revoked" class="chip">revoked</span>
    </p>

    <section class="panel feedback-detail-summary">
      <dl>
        <dt>Reviewer</dt>
        <dd>
          <RouterLink :to="{ name: 'reviewer', params: { slug, address: row.client } }" class="mono" :title="row.client">
            {{ shortAddress(row.client) }}
          </RouterLink>
        </dd>
        <dt>Value</dt>
        <dd><b>{{ formatScore(row.value) }}</b></dd>
        <dt v-if="row.tag1 || row.tag2">Tags</dt>
        <dd v-if="row.tag1 || row.tag2">
          <span v-if="row.tag1" class="chip">{{ row.tag1 }}</span>
          <span v-if="row.tag2" class="chip">{{ row.tag2 }}</span>
        </dd>
        <dt>When</dt>
        <dd>
          <span v-if="row.createdAt" :title="formatDate(row.createdAt)">{{ formatDate(row.createdAt) }} · {{ formatTimeline(row.createdAt) }}</span>
          <span v-else class="muted">Unknown</span>
        </dd>
        <dt v-if="row.endpoint">Endpoint</dt>
        <dd v-if="row.endpoint" class="ellipsis" :title="row.endpoint">{{ row.endpoint }}</dd>
        <dt>Feedback file</dt>
        <dd>
          <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
          <span v-else class="muted">none</span>
          <a v-if="evidenceUrl(row.feedbackURI)" :href="evidenceUrl(row.feedbackURI)" target="_blank" rel="noopener noreferrer"> · open ↗</a>
        </dd>
        <dt>Transaction</dt>
        <dd>
          <a v-if="row.txHash" :href="txExplorerUrl(chain, row.txHash)" target="_blank" rel="noopener noreferrer" class="mono">
            {{ shortAddress(row.txHash) }} ↗
          </a>
          <span v-else class="muted">not known for this row</span>
        </dd>
      </dl>

      <template v-if="row.responses?.length">
        <h3>Replies</h3>
        <ul class="responses">
          <li v-for="(reply, k) in row.responses" :key="k">
            ↩ reply by
            <a :href="addressExplorerUrl(chain, reply.responder)" target="_blank" rel="noopener noreferrer" class="mono">{{ shortAddress(reply.responder) }}</a>
            <template v-if="reply.createdAt"> · {{ formatDate(reply.createdAt) }}</template>
            <template v-if="reply.uri">
              ·
              <a v-if="evidenceUrl(reply.uri)" :href="evidenceUrl(reply.uri)" target="_blank" rel="noopener noreferrer" class="ellipsis">{{ reply.uri }}</a>
              <span v-else class="muted">inline data</span>
            </template>
          </li>
        </ul>
      </template>
    </section>

    <TxDetail v-if="stats" :chain="chain" :agent="agent" :row="row" :index="rowIndex!" :stats="stats" />
  </template>
</template>
