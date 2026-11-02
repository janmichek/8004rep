<script setup lang="ts">
import { Wallet } from '@lucide/vue'
import { computed } from 'vue'
import { chainById, networkNames } from '../chains'
import AddressIdenticon from '../components/AddressIdenticon.vue'
import ChainIcon from '../components/ChainIcon.vue'
import NetworkPicker from '../components/NetworkPicker.vue'
import PageHeader, { type PageFact } from '../components/ui/PageHeader.vue'
import SortHeader from '../components/ui/SortHeader.vue'
import TableSkeleton from '../components/ui/TableSkeleton.vue'
import { sourceFor } from '../data'
import { loadAgentWindow, ownerDirectory, type OwnerEntry } from '../data/directory'
import { shortAddress } from '../format'
import { useScope } from '../scope'
import { useChainLoad } from '../useChainLoad'
import { useRowLink } from '../useRowLink'
import { useSort } from '../useSort'

const props = defineProps<{ slug: string }>()
const scope = useScope(() => props.slug)

const { values, loaded, failed, error, loading, load } = useChainLoad(scope, async (chain) => {
  const { source } = await sourceFor(chain)
  return loadAgentWindow(source)
})

const agents = computed(() => Object.values(values.value).flat())
const owners = computed(() => (loaded.value ? ownerDirectory(agents.value) : undefined))
const windowSize = computed(() => agents.value.length)

const facts = computed<PageFact[]>(() => {
  if (!owners.value) return []
  return [
    { value: owners.value.length.toLocaleString(), label: 'owners' },
    { value: windowSize.value.toLocaleString(), label: 'agents scanned' },
    ...(scope.all.value ? [{ value: String(scope.chains.value.length), label: 'networks' }] : []),
  ]
})

const note = computed(() => {
  if (!owners.value) return undefined
  const where = scope.all.value ? 'across these networks' : 'on this network'
  return `Built from the ${windowSize.value.toLocaleString()} newest agents ${where}. An owner may hold more agents in the registry than shown here; open the owner page for the full count.`
})

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
</script>

<template>
  <PageHeader
    title="Owners"
    description="Who holds the newest registered agents, one row per address."
    :icon="Wallet"
    :facts="facts"
    :note="note"
    :loading="loading && !owners"
  >
    <template #actions>
      <NetworkPicker route-name="owners" :slug="slug" />
    </template>
  </PageHeader>

  <p v-if="failed.length && owners" class="notice">
    Could not load agents on {{ failed.map((f) => f.chain.name).join(', ') }}; those networks are left out.
  </p>

  <p v-if="error" class="notice">Could not load agents: {{ error }} <button @click="load()">Retry</button></p>
  <TableSkeleton
    v-else-if="loading || !owners"
    label="Loading owners"
    :headers="scope.all.value ? ['Owner', 'Agents', 'Networks', 'Newest agent'] : ['Owner', 'Agents', 'Newest agent']"
    :numeric="['Agents', 'Newest agent']"
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
          <td v-if="scope.all.value" :title="networkNames(o.chainIds)">
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
