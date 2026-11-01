<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { chainById } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import ChainIcon from '../components/ChainIcon.vue'
import ChainName from '../components/ChainName.vue'
import NetworkPicker from '../components/NetworkPicker.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { sourceFor } from '../data'
import { loadAgentWindow, ownerDirectory, type OwnerEntry } from '../data/directory'
import { networkEnv } from '../env'
import { shortAddress } from '../format'
import { loadChains, useScope, type ChainFailure } from '../scope'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

const props = defineProps<{ slug: string }>()
const scope = useScope(() => props.slug)
const single = computed(() => (scope.all.value ? undefined : scope.chains.value[0]))

const owners = shallowRef<OwnerEntry[]>()
const windowSize = shallowRef(0)
const failed = shallowRef<ChainFailure[]>([])
const error = shallowRef<string>()
const loading = shallowRef(false)

let run = 0
async function load(): Promise<void> {
  const current = ++run
  const targets = scope.chains.value
  loading.value = true
  error.value = undefined
  owners.value = undefined
  try {
    const result = await loadChains(targets, async (chain) => {
      const { source } = await sourceFor(chain)
      return loadAgentWindow(source)
    })
    if (current !== run) return
    failed.value = result.failed
    if (!result.values.length && result.failed.length) {
      error.value = `${result.failed[0].chain.name}: ${result.failed[0].message}`
      return
    }
    const agents = result.values.flatMap((v) => v.value)
    windowSize.value = agents.length
    owners.value = ownerDirectory(agents)
  } finally {
    if (current === run) loading.value = false
  }
}

watch(scope.key, () => void load(), { immediate: true })

const rows = useSort(
  computed(() => owners.value ?? []),
  [
    { key: 'owner', value: (o) => o.owner.toLowerCase() },
    { key: 'agents', value: (o) => o.agents, numeric: true },
    { key: 'latest', value: (o) => o.latest.tokenId, numeric: true },
  ],
)

const { open } = useRowLink()

// Owner and agent pages are per chain: an owner across networks opens on its main chain.
function ownerRoute(o: OwnerEntry) {
  return { name: 'owner', params: { slug: chainById(o.latest.chainId)?.slug ?? props.slug, address: o.owner } }
}
function agentRoute(o: OwnerEntry) {
  return {
    name: 'agent',
    params: { slug: chainById(o.latest.chainId)?.slug ?? props.slug, id: o.latest.tokenId.toString() },
  }
}
function networkNames(o: OwnerEntry): string {
  return o.chainIds.map((id) => chainById(id)?.shortName ?? String(id)).join(', ')
}
</script>

<template>
  <div class="page-head">
    <h1>
      Owners
      <small>
        <template v-if="scope.all.value">All networks · {{ networkEnv === 'testnet' ? 'Testnet' : 'Mainnet' }}</template>
        <ChainName v-else-if="single" :chain-id="single.chainId" :name="single.name" />
      </small>
    </h1>
    <p class="meta">Owners of the newest registered agents {{ scope.all.value ? 'across these networks' : 'on this network' }}.</p>
    <NetworkPicker class="scope-pick" route-name="owners" :slug="slug" />
  </div>

  <p class="lede">
    Built from the {{ windowSize || 'latest' }} newest agents loaded
    {{ scope.all.value ? 'across every network here' : 'here' }}. An owner with more agents in the registry than shown
    may hold more elsewhere; open the owner page for the full count.
  </p>

  <p v-if="failed.length && owners" class="notice">
    Could not load agents on {{ failed.map((f) => f.chain.name).join(', ') }}; those networks are left out.
  </p>

  <p v-if="error" class="notice">Could not load agents: {{ error }} <button @click="load()">Retry</button></p>
  <TableSkeleton
    v-else-if="loading || !owners"
    label="Loading owners"
    :headers="scope.all.value ? ['Owner', 'Agents', 'Networks', 'Newest agent'] : ['Owner', 'Agents', 'Newest agent']"
    :numeric="scope.all.value ? ['Agents', 'Newest agent'] : ['Agents', 'Newest agent']"
  />

  <p v-else-if="!owners.length" class="state muted">No owners found in the newest agents.</p>

  <div v-else class="table-wrap">
    <table>
      <thead>
        <tr>
          <SortHeader label="Owner" :active="rows.state('owner')" @sort="rows.toggle('owner')" />
          <SortHeader label="Agents" numeric :active="rows.state('agents')" @sort="rows.toggle('agents')" />
          <th v-if="scope.all.value">Networks</th>
          <SortHeader label="Newest agent" numeric :active="rows.state('latest')" @sort="rows.toggle('latest')" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="o in rows.sorted.value"
          :key="o.owner"
          class="row-link"
          role="link"
          tabindex="0"
          :aria-label="`Open owner ${shortAddress(o.owner)}`"
          @click="open(ownerRoute(o), $event)"
          @keydown.enter.prevent="open(ownerRoute(o))"
          @keydown.space.prevent="open(ownerRoute(o))"
        >
          <td>
            <span class="address-mark mono" :title="o.owner">
              <AddressIdenticon :address="o.owner" />
              {{ shortAddress(o.owner) }}
            </span>
          </td>
          <td class="num">{{ o.agents }}</td>
          <td v-if="scope.all.value" :title="networkNames(o)">
            <span v-for="id in o.chainIds" :key="id" class="chain-cell">
              <ChainIcon :chain-id="id" :name="chainById(id)?.name ?? String(id)" :size="14" />
              <span class="chain-name">{{ chainById(id)?.shortName ?? id }}</span>
            </span>
          </td>
          <td class="num">
            <RouterLink :to="agentRoute(o)" @click.stop>#{{ o.latest.tokenId }}</RouterLink>
            <span v-if="scope.all.value" class="chain-cell">
              · <ChainIcon :chain-id="o.latest.chainId" :name="chainById(o.latest.chainId)?.name ?? String(o.latest.chainId)" :size="14" />
              <span class="chain-name">{{ chainById(o.latest.chainId)?.shortName }}</span>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
