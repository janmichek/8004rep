<script setup lang="ts">
import { computed } from 'vue'
import { addressExplorerUrl, txExplorerUrl, type ChainInfo } from '../chains'
import { sourceFor } from '../data'
import type { FeedbackStats } from '../data/feedbackStats'
import { evaluateTxDetail, type CheckStatus } from '../data/txChecks'
import { loadTxFacts } from '../data/txDetail'
import type { AgentDetail, Feedback } from '../data/types'
import { shortAddress } from '../format'
import { useAsync } from '../useAsync'
import Hint from './ui/Hint.vue'
import Skeleton from './ui/Skeleton.vue'

// `index` is the position of `row` in `agent.feedback`, which `stats` is parallel to.
const props = defineProps<{ chain: ChainInfo; agent: AgentDetail; row: Feedback; index: number; stats: FeedbackStats }>()

const STATUS_LABEL: Record<CheckStatus, string> = {
  pass: 'pass',
  warn: 'warn',
  fail: 'fail',
  missing: 'absent',
  unknown: 'unknown',
  info: 'info',
}
/** Bar and legend order: what holds, what might, what does not. */
const BAND_ORDER = ['pass', 'unknown', 'warn', 'missing', 'fail'] as const

const { data: facts, error, loading, reload } = useAsync(
  async () => {
    const { source, rpcClient } = await sourceFor(props.chain)
    return loadTxFacts({
      chain: props.chain,
      client: rpcClient,
      source,
      tokenId: props.agent.tokenId,
      row: props.row,
      feedback: props.agent.feedback,
    })
  },
  () => [props.chain, props.agent, props.row],
)

// Evaluated apart from the loading: the stats change when the registration file arrives.
const view = computed(() =>
  facts.value
    ? evaluateTxDetail(facts.value, {
        chainId: props.chain.chainId,
        nativeSymbol: props.chain.viemChain.nativeCurrency.symbol,
        identity: props.chain.identity,
        reputation: props.chain.reputation,
        tokenId: props.agent.tokenId,
        owner: props.agent.owner,
        agentWallet: props.agent.agentWallet,
        ...(props.agent.createdAt !== undefined ? { agentCreatedAt: props.agent.createdAt } : {}),
        feedback: props.agent.feedback,
        stats: props.stats,
        index: props.index,
      })
    : undefined,
)

const segments = computed(() =>
  view.value ? BAND_ORDER.map((status) => ({ status, count: view.value!.band[status] })).filter((s) => s.count > 0) : [],
)
</script>

<template>
  <section class="tx-detail" aria-label="Tx detail">
    <div class="tx-detail-head">
      <h4>Tx detail</h4>
      <span v-if="facts?.tx" class="tx-detail-meta">
        <a :href="txExplorerUrl(chain, facts.tx.hash)" target="_blank" rel="noopener noreferrer" class="mono">
          {{ shortAddress(facts.tx.hash) }} ↗
        </a>
        · block {{ facts.tx.blockNumber }} · sent by
        <a :href="addressExplorerUrl(chain, facts.tx.from)" target="_blank" rel="noopener noreferrer" class="mono">
          {{ shortAddress(facts.tx.from) }}
        </a>
      </span>
      <span v-if="view" class="tx-detail-meta tx-detail-hint">hover a line for its rule</span>
    </div>

    <p v-if="error" class="tx-detail-state">
      Could not load the tx detail: {{ error }}
      <button class="row-toggle" @click="reload">Retry</button>
    </p>
    <div v-else-if="loading || !view" class="tx-detail-state" aria-busy="true" aria-live="polite">
      <span class="sr-only">Reading the transaction, the feedback file and the reviewer</span>
      <Skeleton width="42%" height="0.9em" />
      <div class="tx-groups">
        <div v-for="group in 4" :key="group" class="tx-group">
          <Skeleton width="7em" height="0.7em" />
          <div class="skeleton-stack">
            <Skeleton v-for="line in 3" :key="line" block height="0.85em" :width="line === 2 ? '78%' : '100%'" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <Hint text="Checks that pass, out of all checks with a verdict. The upper end counts the unknown ones as passing: what could not be read from here may still hold.">
      <div class="tx-band" tabindex="0">
        <span>
          <b>
            {{ view.band.low }}<template v-if="view.band.high !== view.band.low">–{{ view.band.high }}</template>
            of {{ view.band.total }}
          </b>
          checks hold
        </span>
        <span class="tx-bar" aria-hidden="true">
          <span v-for="s in segments" :key="s.status" :class="`status-${s.status}`" :style="{ flex: s.count }" />
        </span>
        <span v-for="s in segments" :key="s.status" class="tx-count" :class="`status-${s.status}`">
          {{ s.count }} {{ STATUS_LABEL[s.status] }}
        </span>
      </div>
      </Hint>

      <div class="tx-groups">
        <div v-for="group in view.groups" :key="group.id" class="tx-group">
          <h5>{{ group.title }}</h5>
          <ul>
            <Hint v-for="check in group.checks" :key="check.id" :text="check.rule">
            <li>
              <span class="tx-status" :class="`status-${check.status}`">{{ STATUS_LABEL[check.status] }}</span>
              <span class="tx-check">
                <b>{{ check.label }}</b>
                {{ check.detail }}
              </span>
            </li>
            </Hint>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
