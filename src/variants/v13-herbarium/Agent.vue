<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { letterGrade, velocity } from '../shared/metrics'
import Sigil from '../shared/Sigil.vue'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { abundance, taxonOf } from './taxonomy'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
const taxon = computed(() => taxonOf(file.value, name.value))
const ab = computed(() => abundance(stats.value?.reviewers.reduce((n, r) => n + r.rows, 0)))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const observed = computed(() => stats.value?.coverage.total ?? 0)
</script>

<template>
  <p v-if="error" class="h-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="h-empty">Unfolding the sheet…</p>
  <template v-else-if="agent === null">
    <p class="h-kicker">Not in the cabinet</p>
    <h1 class="h-h1">No specimen {{ id }} has been pressed.</h1>
  </template>
  <template v-else>
    <p class="h-kicker"><RouterLink :to="to.agents()">Field guide</RouterLink> / collection #{{ agent.tokenId }}</p>
    <h1 class="h-h1">{{ file === undefined ? '…' : name }}</h1>
    <p class="h-lede">
      {{ taxon.genus }} {{ taxon.epithet }} <span style="font-variant: normal; font-size: 14px">({{ taxon.family }})</span>.
      Collected by {{ agent.owner ? shortAddress(agent.owner) : 'an unknown hand' }}<template v-if="agent.createdAt"> on {{ formatDate(agent.createdAt) }}</template>.
    </p>

    <div class="h-sheet">
      <div>
        <div class="h-press">
          <Sigil :seed="`${agent.chainId}:${agent.tokenId}`" :image="file?.image" :size="196" :palette="['#3f5d3a', '#7d8a4e', '#9a5b3f', '#b28b3c', '#2c4229']" />
          <span class="h-stamp">det. {{ grade }}</span>
        </div>
        <dl class="h-block" style="margin-top: 14px">
          <dt>Species</dt><dd>{{ name }}</dd>
          <dt>Family</dt><dd>{{ taxon.family }}</dd>
          <dt>Genus</dt><dd>{{ taxon.genus }}</dd>
          <dt>Collection</dt><dd>#{{ agent.tokenId }} · {{ chain.name }}</dd>
          <dt>Collector</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else>—</span></dd>
          <dt>Agent wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (same hand)' : '' }}</dd>
          <dt>Habitat</dt><dd>{{ file?.services.map((s) => `${s.name} @ ${s.endpoint}`).join(' · ') || 'undescribed' }}</dd>
          <dt>Trust models</dt><dd>{{ file?.supportedTrust.join(', ') || 'none declared' }}</dd>
          <dt>Sheet</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline data' : 'not supplied' }}</span></dd>
          <dt>Abundance</dt><dd>{{ ab.word }}<template v-if="observed"> · {{ observed }} observations</template></dd>
        </dl>
        <p class="h-mono" style="margin-top: 12px"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></p>
      </div>

      <div>
        <h2 class="h-h2" style="margin-top: 0">Field description</h2>
        <p class="h-prose">{{ file?.description ?? 'The collector supplied no description.' }}</p>
        <p v-if="file?.active === false" class="h-prose"><i>Inactive at the time of collection.</i></p>
        <p>
          <span v-for="t in file?.supportedTrust ?? []" :key="t" class="h-tag">{{ t }}</span>
          <span v-for="s in file?.services ?? []" :key="s.name + s.endpoint" class="h-tag" :title="s.endpoint">{{ s.name }}</span>
        </p>

        <div class="h-tiles">
          <div><small>Determination</small><b>{{ grade }}</b></div>
          <div><small>Trusted value</small><b>{{ formatNumber(report?.trusted) }}</b></div>
          <div><small>Raw mean</small><b>{{ formatNumber(report?.raw) }}</b></div>
          <div><small>Observers</small><b>{{ stats?.reviewers.length ?? 0 }}</b></div>
        </div>

        <h2 class="h-h2">Field notes</h2>
        <p v-if="!stats?.signals.length" class="h-empty">Nothing anomalous was noted.</p>
        <ul v-else class="h-notes">
          <li v-for="s in stats.signals" :key="s.code"><span class="h-level">{{ s.level }}</span>{{ s.text }}</li>
        </ul>

        <h2 class="h-h2">Determination key</h2>
        <ul class="h-notes">
          <li v-for="step in report?.waterfall ?? []" :key="step.id">
            <b>{{ step.label }}</b> — {{ step.rule }}
            <span class="soft">→ {{ formatNumber(step.average) }}<template v-if="step.delta !== null"> ({{ formatSigned(step.delta) }})</template></span>
          </li>
        </ul>
        <p class="h-empty" style="font-size: 13px">{{ report?.headline ?? '' }}</p>

        <h2 class="h-h2">Observations</h2>
        <p v-if="agent.feedbackSince" class="h-empty">Observations dated from {{ formatDate(agent.feedbackSince) }}; {{ formatNumber(velocity(agent.feedback.map((f) => f.createdAt))) }} per day across the span.</p>
        <p v-if="!agent.feedback.length" class="h-empty">No observation has been recorded.</p>
        <div v-else class="h-obs-wrap">
          <div class="h-obs head"><span>No.</span><span>Note</span><span>Observer</span><span>Value</span><span>Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="h-obs" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'a bare value' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> 〔{{ FLAG_INFO[f].label }}〕</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" class="h-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </div>

        <div class="h-cols" style="margin-top: 26px">
          <div>
            <h2 class="h-h2" style="margin-top: 0">Observers</h2>
            <ul class="h-list">
              <li v-for="r in stats?.reviewers.slice(0, 12) ?? []" :key="r.client">
                <span><RouterLink :to="to.reviewer(r.client)" class="h-mono">{{ shortAddress(r.client) }}</RouterLink></span>
                <span class="soft">{{ r.rows }} obs · {{ formatPercent(r.weightShare) }} of weight</span>
              </li>
            </ul>
          </div>
          <div class="h-side">
            <h2 class="h-h2" style="margin-top: 0">Condition</h2>
            <p v-for="reason in report?.strength.reasons ?? []" :key="reason">{{ reason }}</p>
            <p class="soft">{{ stats?.coverage.dated ?? 0 }} dated · {{ stats?.coverage.withUri ?? 0 }} with notes · {{ stats?.coverage.withTx ?? 0 }} with transactions.</p>
            <details v-if="rawJson"><summary class="h-kicker">Registration sheet</summary><pre>{{ rawJson }}</pre></details>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
