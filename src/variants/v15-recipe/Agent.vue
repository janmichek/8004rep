<script setup lang="ts">
import { computed, ref } from 'vue'
import { addressExplorerUrl, agentScanUrl } from '../../chains'
import FeedbackNote from '../../components/FeedbackNote.vue'
import { FLAG_INFO } from '../../data/feedbackStats'
import type { StrengthTier } from '../../data/trustReport'
import { formatDate, formatNumber, formatPercent, formatScore, formatSigned, shortAddress } from '../../format'
import { letterGrade, velocity } from '../shared/metrics'
import TxPanel from '../shared/TxPanel.vue'
import { routes, useAgentDetail, useChain } from '../shared/use'
import { confidenceOf, starsOf } from './taste'

const props = defineProps<{ slug: string; id: string }>()
const chain = useChain(() => props.slug)
const to = routes(() => chain.value)
const { agent, file, stats, report, scores, name, uriLink, rawJson, walletIsOwner, error, loading, reload } = useAgentDetail(chain, () => props.id)
const open = ref<number>()
const stars = computed(() => starsOf(report.value?.trusted))
const taste = computed(() => confidenceOf(stats.value?.coverage.total))
const grade = computed(() => (report.value && stats.value ? letterGrade(report.value.trusted, report.value.strength.tier, stats.value.level) : 'NR'))
const serves = computed(() => Math.max(0, Math.round(scores.value?.effectiveCount ?? 0)))
const tierWords: Record<StrengthTier, string> = { none: 'nothing usable', thin: 'a thin base', moderate: 'a fair base', strong: 'a deep base' }
const reviewerWeight = computed(() => stats.value?.reviewers.reduce((n, r) => n + (r.weightShare ?? 0), 0) ?? 0)
</script>

<template>
  <p v-if="error" class="r-err">{{ error }} <button @click="reload">Retry</button></p>
  <p v-else-if="loading || agent === undefined" class="r-empty">Taking the card from the box…</p>
  <template v-else-if="agent === null">
    <p class="r-kicker">Not on the menu</p>
    <h1 class="r-h1">Dish {{ id }} was never served here.</h1>
  </template>
  <template v-else>
    <p class="r-kicker"><RouterLink :to="to.agents()">Recipe index</RouterLink> / dish {{ agent.tokenId }}</p>
    <div class="r-sheet">
      <aside class="r-aside">
        <h3>The card</h3>
        <dl class="r-spec">
          <dt>Dish</dt><dd>{{ name }}</dd>
          <dt>Chef</dt><dd><RouterLink v-if="agent.owner" :to="to.owner(agent.owner)">{{ agent.owner }}</RouterLink><span v-else>—</span></dd>
          <dt>Wallet</dt><dd><a v-if="agent.agentWallet" :href="addressExplorerUrl(chain, agent.agentWallet)" target="_blank" rel="noopener noreferrer">{{ shortAddress(agent.agentWallet) }}</a><span v-else>—</span>{{ walletIsOwner ? ' (chef)' : '' }}</dd>
          <dt>Ingredients</dt><dd>{{ file?.services.map((s) => s.name).join(', ') || 'none declared' }}</dd>
          <dt>Trust</dt><dd>{{ file?.supportedTrust.join(', ') || 'none declared' }}</dd>
          <dt>First served</dt><dd>{{ agent.createdAt ? formatDate(agent.createdAt) : 'undated' }}</dd>
          <dt>Card</dt><dd><a v-if="uriLink" :href="uriLink" target="_blank" rel="noopener noreferrer">{{ agent.agentURI }}</a><span v-else>{{ agent.agentURI ? 'inline' : '—' }}</span></dd>
          <dt>Serves</dt><dd>{{ serves }} full servings</dd>
          <dt>Base</dt><dd>{{ tierWords[report?.strength.tier ?? 'none'] }}</dd>
        </dl>
        <p class="r-mono" style="margin-top: 12px"><a :href="agentScanUrl(chain, agent.tokenId)" target="_blank" rel="noopener noreferrer">8004scan ↗</a></p>
        <h3 style="margin-top: 16px">Kitchen notes</h3>
        <p class="r-note">{{ report?.headline ?? 'No tastings on record.' }}</p>
        <p v-if="agent.feedbackSince" class="r-note">Tastings dated from {{ formatDate(agent.feedbackSince) }}; {{ formatNumber(velocity(agent.feedback.map((f) => f.createdAt))) }} per day over the span.</p>
        <details v-if="rawJson"><summary class="r-kicker">Registration file</summary><pre>{{ rawJson }}</pre></details>
      </aside>

      <div>
        <div class="r-hero">
          <div>
            <h1 class="r-h1" style="margin: 0">{{ file === undefined ? '…' : name }}</h1>
            <p class="r-prose" style="margin: 8px 0 0">{{ file?.description ?? 'No headnote came with this card.' }}</p>
          </div>
          <div style="text-align: right">
            <div class="r-stars" :title="formatNumber(report?.trusted)">
              <span v-for="(star, i) in stars" :key="i" :class="{ off: star === 'off' }">{{ star === 'off' ? '☆' : '★' }}</span>
            </div>
            <b>{{ formatNumber(report?.trusted) }}</b>
            <div class="r-sub">would make again: {{ grade }}</div>
          </div>
        </div>

        <div class="r-tiles">
          <div><small>Trusted taste</small><b>{{ formatNumber(report?.trusted) }}</b></div>
          <div><small>Raw taste</small><b>{{ formatNumber(report?.raw) }}</b></div>
          <div><small>Gap</small><b>{{ report?.raw != null && report?.trusted != null ? formatNumber(report.raw - report.trusted) : '—' }}</b></div>
          <div><small>Servings</small><b>{{ serves }}</b></div>
        </div>

        <h2 class="r-h2">Ingredients · who tasted it</h2>
        <p v-if="!stats?.reviewers.length" class="r-empty">No tastings yet.</p>
        <ul v-else class="r-ingredients">
          <li v-for="r in stats.reviewers" :key="r.client">
            <span><RouterLink :to="to.reviewer(r.client)" class="r-mono">{{ shortAddress(r.client) }}</RouterLink></span>
            <span>{{ r.rows }} tasting{{ r.rows === 1 ? '' : 's' }} · weight {{ formatNumber(r.weightShare, 2) }}</span>
          </li>
        </ul>
        <p class="r-note">{{ formatPercent(reviewerWeight) }} of the kitchen's weight is accounted for above.</p>

        <h2 class="r-h2">Method · how the score was cooked</h2>
        <ol class="r-steps">
          <li v-for="step in report?.waterfall ?? []" :key="step.id">
            <b>{{ step.label }}.</b> {{ step.rule }}
            <span class="soft">→ {{ formatNumber(step.average) }}<template v-if="step.delta !== null"> ({{ formatSigned(step.delta) }})</template>, {{ step.rows }} row{{ step.rows === 1 ? '' : 's' }} affected.</span>
          </li>
        </ol>

        <h2 class="r-h2">Tasting notes</h2>
        <p v-if="!agent.feedback.length" class="r-empty">The plate came back untouched.</p>
        <div v-else>
          <div class="r-tasting head"><span>#</span><span>Note</span><span>Taster</span><span class="num">Score</span><span class="num">Weight</span></div>
          <template v-for="(row, i) in agent.feedback" :key="i">
            <div class="r-tasting" :class="{ revoked: row.revoked }" @click="open = open === i ? undefined : i">
              <span class="idx">{{ i + 1 }}</span>
              <span>
                <FeedbackNote v-if="row.feedbackURI" :uri="row.feedbackURI" />
                <span v-else>{{ [row.tag1, row.tag2].filter(Boolean).join(' / ') || 'a bare score' }}</span>
                <span v-for="f in stats?.rows[i]?.flags ?? []" :key="f" class="soft"> ({{ FLAG_INFO[f].label }})</span>
              </span>
              <RouterLink :to="to.reviewer(row.client)" class="r-mono" @click.stop>{{ shortAddress(row.client) }}</RouterLink>
              <span class="num">{{ formatScore(row.value) }}</span>
              <span class="num">{{ formatNumber(stats?.rows[i]?.weight, 2) }}</span>
            </div>
            <TxPanel v-if="open === i && stats" :chain="chain" :agent="agent" :row="row" :index="i" :stats="stats" />
          </template>
        </div>

        <div class="r-columns" style="margin-top: 26px">
          <div>
            <h2 class="r-h2" style="margin-top: 0">About the tasting</h2>
            <p class="r-prose" style="font-size: 13px">{{ taste.detail }}. The stars use the trusted score, not the raw mean: the method above explains every move.</p>
            <p class="r-prose" style="font-size: 13px">{{ stats?.coverage.withUri ?? 0 }} of {{ stats?.coverage.total ?? 0 }} notes point to a file; {{ stats?.coverage.withTx ?? 0 }} carry a transaction.</p>
          </div>
          <div class="r-side">
            <h2 class="r-h2" style="margin-top: 0">Would we make it again?</h2>
            <p v-for="reason in report?.strength.reasons ?? []" :key="reason" class="r-prose" style="font-size: 13px">{{ reason }}</p>
            <p class="r-note">Largest taster shifts the raw mean by {{ formatSigned(stats?.reviewers[0]?.shiftWithout) }}.</p>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
