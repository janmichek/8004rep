<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import FlagChip from '../components/ui/FlagChip.vue'
import ReviewerChip from '../components/ui/ReviewerChip.vue'
import { CHAINS, DEFAULT_CHAIN } from '../chains'
import { FLAG_INFO, type RowFlag } from '../data/feedbackStats'
import { GLOSSARY_GROUPS } from '../data/glossary'
import { METRIC_GROUPS } from '../data/metricsGuide'
import { LABEL_INFO, type ReviewerLabel } from '../data/reviewerProfile'
import { DOMINANT_SHARE, STRONG_NEFF, STRONG_WEIGHT, THIN_WEIGHT, THIN_WALLETS } from '../data/reputation/score'
import { UNIT_WINDOW_DAYS } from '../data/reputation/units'

const route = useRoute()

// Landing on a section does not scroll (see router scrollBehavior); it just
// flashes the target so the reader's eye finds it.
function flashSection(hash: string): void {
  const id = hash.replace(/^#/, '')
  if (!id) return
  void nextTick(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.classList.remove('docs-flash')
    void el.offsetWidth
    el.classList.add('docs-flash')
    setTimeout(() => el.classList.remove('docs-flash'), 2200)
  })
}

onMounted(() => flashSection(route.hash))
watch(() => route.hash, flashSection)

const defaultSlug = DEFAULT_CHAIN.slug

const networkCount = computed(() => CHAINS.length)
const termCount = computed(() => GLOSSARY_GROUPS.reduce((total, group) => total + group.entries.length, 0))
const metricCount = computed(() => METRIC_GROUPS.reduce((total, group) => total + group.metrics.length, 0))
const flags = (Object.entries(FLAG_INFO) as [RowFlag, { label: string; rule: string }][]).map(([id, info]) => ({ id, ...info }))
const labels = (
  Object.entries(LABEL_INFO) as [ReviewerLabel, { label: string; rule: string; tone: string }][]
).map(([id, info]) => ({ id, ...info }))

function href(id: string): string {
  return id ? `#/docs#${id}` : '#/docs'
}

function scrollToTop(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}
</script>

<template>
  <div class="docs">
    <header class="docs-hero">
      <div class="docs-hero-glow" aria-hidden="true"></div>
      <p class="docs-kicker"><span class="docs-kicker-dot"></span>ERC-8004 reputation, explained</p>
      <h1>A read-only explorer for ERC-8004 agents and their <em>reputation</em>.</h1>
      <p class="docs-lead">
        Every agent on a supported network has an identity and a reputation registry. This app reads both, then turns the
        raw feedback rows into a score you can inspect, argue with and recompute. No wallet, no account, no backend: the
        numbers are calculated in your browser from on-chain data and public subgraphs.
      </p>
      <dl class="docs-stats">
        <div>
          <dt>Networks</dt>
          <dd>{{ networkCount }}<span class="docs-stat-note">mainnets and testnets read directly</span></dd>
        </div>
        <div>
          <dt>Terms</dt>
          <dd>{{ termCount }}<span class="docs-stat-note">defined in plain language</span></dd>
        </div>
        <div>
          <dt>Metrics</dt>
          <dd>{{ metricCount }}<span class="docs-stat-note">with rules, sources and caveats</span></dd>
        </div>
        <div>
          <dt>One wallet, one vote</dt>
          <dd>1:1<span class="docs-stat-note">per tag, per {{ UNIT_WINDOW_DAYS }}-day window</span></dd>
        </div>
      </dl>
      <nav class="docs-jump" aria-label="Start here">
        <a :href="href('entities')">Entities</a>
        <a :href="href('vocabulary')">Vocabulary</a>
        <a :href="href('how')">How it works</a>
        <a :href="href('sybil')">Sybil checks</a>
        <a :href="href('rules')">Rules</a>
        <a :href="href('metrics')">Metric guide</a>
        <a :href="href('limits')">Limits</a>
        <RouterLink :to="{ name: 'agents', params: { slug: defaultSlug } }">Browse agents</RouterLink>
        <RouterLink :to="{ name: 'network', params: { slug: defaultSlug } }">Network health</RouterLink>
      </nav>
    </header>

    <section
      v-for="group in GLOSSARY_GROUPS"
      :id="group.id"
      :key="group.id"
      class="docs-section docs-glossary"
    >
      <h2>{{ group.title }}</h2>
      <p class="docs-section-intro">{{ group.intro }}</p>
      <dl class="docs-glossary-list">
        <div v-for="entry in group.entries" :id="entry.id" :key="entry.id" class="docs-glossary-item">
          <dt>
            <a :href="href(entry.id)" :title="`Link to ${entry.name}`">{{ entry.name }}</a>
          </dt>
          <dd>
            {{ entry.summary }}
            <a v-if="entry.seeAlso" class="docs-glossary-see" :href="href(entry.seeAlso)">See metric</a>
          </dd>
        </div>
      </dl>
    </section>

    <section id="how" class="docs-section">
      <h2>How it works</h2>
      <p class="docs-section-intro">
        Three passes turn raw registry rows into a number you can defend: collect, classify, then show every step.
      </p>
      <ol class="docs-steps">
        <li>
          <b>Read the registries.</b>
          <span>
            Identity and reputation events come from the ERC-8004 contracts, with the agent0 subgraph filling in metadata
            and names where a network has one. Chains without a subgraph are read over RPC only.
          </span>
        </li>
        <li>
          <b>Classify every row.</b>
          <span>
            A value can be a rating, an outcome, a telemetry reading or a quantity. Only ratings are normalised, collapsed
            into one vote per wallet, tag and 30-day window, and allowed into the score.
          </span>
        </li>
        <li>
          <b>Show the working.</b>
          <span>
            The score is a conservative average with a neutral prior. Every input, weight, flag and alternative number is
            on the page, and the Methods tab can download the exact inputs as JSON.
          </span>
        </li>
      </ol>
      <p class="docs-note">
        The explorer is a lens, not an oracle. A high score means “this much independent rating evidence points here”, not
        “this agent is safe to use”. Read the evidence alongside the number.
      </p>

      <h3 id="sybil" class="docs-subhead">Uncovering sybil feedback</h3>
      <p>
        Nothing is hidden: suspected rows stay visible and keep their value. Three signals decide how little they count.
      </p>
      <ul class="docs-checks">
        <li>
          <b>One wallet, one vote.</b>
          Rows from the same wallet, tag and 30-day window collapse into one median vote, so extra volume is not extra
          weight.
        </li>
        <li>
          <b>Row rules.</b>
          Self-feedback and exact repeats weigh zero; bursts and one-value reviewers are discounted, and a neutral prior
          keeps thin or dominated evidence from reading as confident.
        </li>
        <li>
          <b>Wallet links.</b>
          Reviewers first funded by the same address are grouped on the Reviewers tab, and agents rated by nearly the same
          set of wallets (80% overlap) are flagged on Network health.
        </li>
      </ul>
    </section>

    <section id="rules" class="docs-section">
      <h2>Rules on feedback and reviewers</h2>
      <p class="docs-section-intro">
        These are the rules applied to every row and every reviewer. They are stated here once; the agent page's Methods
        tab links back instead of repeating them.
      </p>

      <h3 class="docs-subhead">Rules on each feedback row</h3>
      <dl class="metric-list">
        <template v-for="f in flags" :key="f.id">
          <dt><FlagChip :flag="f.id" /></dt>
          <dd>{{ f.rule }}</dd>
        </template>
      </dl>

      <h3 class="docs-subhead">Rules on a reviewer</h3>
      <dl class="metric-list">
        <template v-for="l in labels" :key="l.id">
          <dt><ReviewerChip :label="l.id" /></dt>
          <dd>{{ l.rule }}</dd>
        </template>
      </dl>

      <h3 class="docs-subhead">Confidence levels</h3>
      <dl class="metric-list">
        <dt>low</dt>
        <dd>Under {{ THIN_WEIGHT }} full votes or under {{ THIN_WALLETS }} wallets.</dd>
        <dt>moderate</dt>
        <dd>Anything between low and high.</dd>
        <dt>high</dt>
        <dd>{{ STRONG_WEIGHT }}+ full votes, {{ STRONG_NEFF }}+ effective voices, and no wallet holding {{ DOMINANT_SHARE * 100 }}% of the weight.</dd>
        <dt>Unrated</dt>
        <dd>No rating rows at all. Telemetry and outcomes are shown but never scored.</dd>
      </dl>
      <p class="docs-note">
        Everything is computed in your browser from on-chain rows. No IP, device or text signals exist on-chain; a reviewer
        with many fresh wallets that each rate once at varied values passes every rule. Shared funders on the Reviewers tab
        are the check for that.
      </p>
    </section>

    <section id="metrics" class="docs-section docs-metrics">
      <div class="docs-metrics-head">
        <h2>Metric guide</h2>
        <p>
          Every metric has a permanent anchor. When a tooltip, chip or number needs to explain itself later, it can link
          to the matching paragraph with <code>{ name: 'docs', hash: '#id' }</code>.
        </p>
      </div>

      <div class="docs-metrics-body">
        <aside class="docs-toc" aria-label="Metrics">
          <p class="docs-toc-title">{{ metricCount }} metrics</p>
          <nav>
            <template v-for="group in METRIC_GROUPS" :key="group.id">
              <a class="docs-toc-group" :href="href(group.id)">{{ group.title }}</a>
              <ol>
                <li v-for="metric in group.metrics" :key="metric.id">
                  <a :href="href(metric.id)">{{ metric.name }}</a>
                </li>
              </ol>
            </template>
          </nav>
        </aside>

        <div class="docs-groups">
          <section v-for="group in METRIC_GROUPS" :id="group.id" :key="group.id" class="docs-group">
            <div class="docs-group-head">
              <h2>{{ group.title }}</h2>
              <span class="docs-group-count">{{ group.metrics.length }} metrics</span>
            </div>
            <p class="docs-group-intro">{{ group.intro }}</p>

            <article v-for="metric in group.metrics" :id="metric.id" :key="metric.id" class="docs-metric">
              <h3>
                <a :href="href(metric.id)" :title="`Link to ${metric.name}`">{{ metric.name }}</a>
              </h3>
              <p>{{ metric.summary }}</p>
              <p v-if="metric.rule" class="docs-rule">{{ metric.rule }}</p>
              <p v-if="metric.where" class="docs-where"><span>Seen in</span> {{ metric.where }}</p>
              <p v-if="metric.caveat" class="docs-caveat"><span>Worth knowing</span> {{ metric.caveat }}</p>
            </article>
          </section>
        </div>
      </div>
    </section>

    <section id="limits" class="docs-section">
      <h2>What it cannot see</h2>
      <p class="docs-section-intro">
        A score is only as good as the evidence behind it. These are the gaps the page will not paper over.
      </p>
      <ul class="docs-limits">
        <li>
          <b>On-chain feedback are only as independent as their wallets.</b>
          Fresh wallets that each rate once at varied values pass every rule. Shared funding is the check for that, and
          “cost to fake” prices the effort.
        </li>
        <li>
          <b>Text is not judged.</b>
          The registries hold no feedback to read beyond a URI. A feedback file can point to a comment, a task or a payment
          proof, but this app does not fetch or grade its prose.
        </li>
        <li>
          <b>One window of history.</b>
          RPC log scans and source caps limit how far back the page reads. When a total is larger than the rows held, the
          page says how many feedback the computation actually used.
        </li>
        <li>
          <b>Availability changes the view.</b>
          If a subgraph or RPC endpoint is unavailable, the source badge says so and the data falls back or stops. Empty
          is not the same as zero.
        </li>
        <li>
          <b>Not a security audit.</b>
          The page reports reputation evidence for a specific agent. It does not audit the agent’s code, permissions or
          funds.
        </li>
      </ul>
    </section>

    <section id="sources" class="docs-section">
      <h2>Sources</h2>
      <ul class="docs-sources">
        <li>ERC-8004 identity and reputation registries, read over public RPC endpoints.</li>
        <li>The agent0 public subgraphs, where the chain has one.</li>
        <li>Registration files served by agents themselves, for services and metadata.</li>
        <li>8004scan’s public API, used only for comparison and scan-only agents.</li>
      </ul>
      <p class="docs-note">
        The app is open source and runs entirely client-side. There is no account to create and nothing to connect.
      </p>
    </section>

    <footer class="docs-footer">
      <RouterLink :to="{ name: 'agents', params: { slug: defaultSlug } }">Agents</RouterLink>
      <RouterLink :to="{ name: 'network', params: { slug: defaultSlug } }">Network health</RouterLink>
      <a :href="href('metrics')">Back to the metric guide</a>
      <button type="button" class="docs-top" @click="scrollToTop">Back to top ↑</button>
    </footer>
  </div>
</template>

<style scoped>
.docs-flash {
  animation: docs-flash 2.2s ease-out;
}

@keyframes docs-flash {
  0% {
    background-color: color-mix(in srgb, var(--accent) 38%, transparent);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent) 60%, transparent),
      inset 0 0 0 100vmax color-mix(in srgb, var(--accent) 16%, transparent);
  }
  35% {
    background-color: color-mix(in srgb, var(--accent) 30%, transparent);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent) 60%, transparent),
      inset 0 0 0 100vmax color-mix(in srgb, var(--accent) 12%, transparent);
  }
  100% {
    background-color: transparent;
    box-shadow:
      0 0 0 0 transparent,
      inset 0 0 0 100vmax transparent;
  }
}

.docs {
  --docs-bg: #0a0d12;
  --docs-panel: #121822;
  --docs-panel-2: #161d2a;
  --docs-line: #26303f;
  --docs-text: #e4eaf4;
  --docs-muted: #96a3b8;
  --docs-accent: #5eead4;
  --docs-link: #9cc0ff;
  --docs-warn: #f5b84b;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 28px 88px;
  background: var(--docs-bg);
  border-radius: 16px;
  color: var(--docs-text);
  font: 14px/1.65 system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.docs a {
  color: var(--docs-link);
  text-decoration: none;
}

.docs a:hover {
  text-decoration: underline;
}

.docs code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #0a0e15;
  border: 1px solid var(--docs-line);
  color: var(--docs-accent);
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.docs-hero {
  position: relative;
  isolation: isolate;
  padding: 46px 0 40px;
  border-bottom: 1px solid var(--docs-line);
}

/* Bleeds past the centred column so the wash reaches both viewport edges. */
.docs-hero-glow {
  position: absolute;
  z-index: -1;
  top: -24px;
  bottom: -60px;
  left: 50%;
  width: 100vw;
  transform: translateX(-50%);
  background:
    radial-gradient(780px 300px at 22% 0%, color-mix(in srgb, var(--docs-accent) 12%, transparent), transparent 72%),
    radial-gradient(620px 260px at 84% 24%, color-mix(in srgb, #7dd3fc 9%, transparent), transparent 70%);
  pointer-events: none;
}

.docs-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 14px;
  color: color-mix(in srgb, var(--docs-accent) 82%, #fff);
  font: 600 11.5px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.docs-kicker-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--docs-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--docs-accent) 18%, transparent);
}

.docs h1 {
  max-width: 880px;
  margin: 0;
  color: #fff;
  font-size: clamp(30px, 4.2vw, 48px);
  line-height: 1.1;
  letter-spacing: -0.025em;
  text-wrap: balance;
}

.docs h1 em {
  font-style: normal;
  background: linear-gradient(100deg, var(--docs-accent), #7dd3fc 55%, #a5b4fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.docs-lead {
  max-width: 760px;
  margin: 20px 0 0;
  color: var(--docs-muted);
  font-size: 16px;
  line-height: 1.7;
}

/* These <dl>s are card grids, not definition tables: drop the global panel. */
.docs-stats,
.docs-glossary-list {
  border: 0;
  border-radius: 0;
  background: none;
}

.docs-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 30px 0 0;
}

.docs-stats > div {
  padding: 15px 16px 16px;
  border: 1px solid var(--docs-line);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.012));
}

.docs-stats dt {
  margin: 0;
  padding: 0;
  border-bottom: 0;
  color: var(--docs-muted);
  font: 600 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.docs-stats dd {
  margin: 8px 0 4px;
  padding: 0;
  border-bottom: 0;
  color: #fff;
  font: 600 30px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.docs-stat-note {
  display: block;
  margin-top: 6px;
  color: var(--docs-muted);
  font: 400 11.5px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
  letter-spacing: 0;
}

.docs-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 26px;
  font-size: 13px;
}

.docs-jump a {
  padding: 6px 12px;
  border: 1px solid var(--docs-line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--docs-panel) 70%, transparent);
  color: var(--docs-text);
  transition: border-color 0.16s ease, color 0.16s ease, background 0.16s ease;
}

.docs-jump a:hover {
  border-color: color-mix(in srgb, var(--docs-accent) 45%, var(--docs-line));
  background: color-mix(in srgb, var(--docs-accent) 9%, transparent);
  color: var(--docs-accent);
  text-decoration: none;
}

.docs-section {
  padding-top: 54px;
  scroll-margin-top: 84px;
}

.docs-section > h2,
.docs-metrics-head h2 {
  margin: 0 0 12px;
  color: #fff;
  font-size: 24px;
  letter-spacing: -0.015em;
}

.docs-section-intro {
  max-width: 780px;
  margin: 0 0 20px;
  color: var(--docs-muted);
  font-size: 14.5px;
}

.docs-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.docs-steps li {
  position: relative;
  padding: 20px 20px 20px 58px;
  border: 1px solid var(--docs-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--docs-panel-2), var(--docs-panel));
  counter-increment: step;
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.docs-steps li:hover {
  border-color: color-mix(in srgb, var(--docs-accent) 35%, var(--docs-line));
  transform: translateY(-2px);
}

.docs-steps li::before {
  content: counter(step, decimal-leading-zero);
  position: absolute;
  top: 19px;
  left: 17px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid color-mix(in srgb, var(--docs-accent) 30%, var(--docs-line));
  border-radius: 9px;
  background: color-mix(in srgb, var(--docs-accent) 10%, transparent);
  color: var(--docs-accent);
  font: 600 11.5px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.docs-steps b {
  display: block;
  margin-bottom: 7px;
  color: #fff;
  font-size: 14.5px;
}

.docs-steps span {
  color: var(--docs-muted);
  font-size: 13px;
  line-height: 1.6;
}

.docs-note {
  max-width: 780px;
  margin: 18px 0 0;
  padding: 12px 14px;
  border-left: 2px solid var(--docs-warn);
  border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--docs-warn) 8%, transparent);
  color: var(--docs-muted);
  font-size: 13px;
}

.docs-subhead {
  margin: 40px 0 8px;
  color: #fff;
  font-size: 18px;
  letter-spacing: -0.01em;
  scroll-margin-top: 84px;
}

.docs-checks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px;
  max-width: 960px;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.docs-checks li {
  position: relative;
  padding: 18px 18px 18px;
  border: 1px solid var(--docs-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--docs-panel), color-mix(in srgb, var(--docs-panel) 60%, transparent));
  color: var(--docs-muted);
  font-size: 13px;
  transition: border-color 0.18s ease, transform 0.18s ease;
}

.docs-checks li:hover {
  border-color: color-mix(in srgb, var(--docs-warn) 40%, var(--docs-line));
  transform: translateY(-2px);
}

.docs-checks b {
  display: block;
  margin-bottom: 7px;
  color: var(--docs-text);
  font-size: 14.5px;
}

.docs-chains {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.docs-chains > div {
  padding: 18px 20px;
  border: 1px solid var(--docs-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--docs-panel-2), var(--docs-panel));
  transition: border-color 0.18s ease;
}

.docs-chains > div:hover {
  border-color: color-mix(in srgb, var(--docs-accent) 35%, var(--docs-line));
}

.docs-chains h3 {
  margin: 0 0 10px;
  color: #fff;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.docs-chains ul {
  margin: 0;
  padding-left: 18px;
  color: var(--docs-muted);
}

.docs-chains li + li {
  margin-top: 4px;
}

.docs-glossary-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin: 0;
}

.docs-glossary-item {
  position: relative;
  padding: 16px 18px 17px;
  border: 1px solid var(--docs-line);
  border-radius: 13px;
  background: var(--docs-panel);
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

.docs-glossary-item:hover {
  border-color: color-mix(in srgb, var(--docs-accent) 38%, var(--docs-line));
  transform: translateY(-2px);
  box-shadow: 0 16px 32px -26px #000;
}

.docs-glossary-item dt {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 7px;
  padding: 0;
  border-bottom: 0;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.docs-glossary-item dt a {
  color: #fff;
  text-decoration: none;
}

.docs-glossary-item dt a:hover {
  color: var(--docs-accent);
}

.docs-glossary-item dd {
  margin: 0;
  padding: 0;
  border-bottom: 0;
  color: var(--docs-muted);
  font-size: 13px;
  line-height: 1.55;
}

.docs-glossary-see {
  display: inline-block;
  margin-left: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.docs-metrics-head {
  padding-bottom: 24px;
}

.docs-metrics-head > p:last-child {
  max-width: 780px;
  margin: 0;
  color: var(--docs-muted);
}

.docs-metrics-body {
  display: grid;
  grid-template-columns: 252px minmax(0, 1fr);
  gap: 42px;
  align-items: start;
}

.docs-toc {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 110px);
  overflow: auto;
  padding: 2px 12px 2px 0;
  border-right: 1px solid var(--docs-line);
  scrollbar-width: thin;
}

.docs-toc-title {
  margin: 0 0 10px;
  padding-left: 13px;
  color: var(--docs-accent);
  font: 600 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.docs-toc-group {
  display: block;
  margin-top: 16px;
  padding-left: 13px;
  color: var(--docs-muted);
  font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.docs-toc-group:first-of-type {
  margin-top: 0;
}

.docs-toc ol {
  margin: 5px 0 0;
  padding: 0;
  list-style: none;
  border-left: 1px solid var(--docs-line);
}

.docs-toc li {
  margin: 0;
}

.docs-toc li a {
  display: block;
  margin-left: -1px;
  padding: 3px 6px 3px 12px;
  border-left: 1px solid transparent;
  color: var(--docs-text);
  font-size: 12.5px;
  opacity: 0.76;
  transition: border-color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}

.docs-toc li a:hover {
  border-left-color: var(--docs-accent);
  background: color-mix(in srgb, var(--docs-accent) 7%, transparent);
  opacity: 1;
  text-decoration: none;
}

.docs-groups {
  min-width: 0;
}

.docs-group {
  padding: 0 0 40px;
  scroll-margin-top: 84px;
}

.docs-group + .docs-group {
  padding-top: 34px;
  border-top: 1px solid var(--docs-line);
}

.docs-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 8px;
}

.docs-group h2 {
  margin: 0;
  color: #fff;
  font-size: 20px;
  letter-spacing: -0.01em;
}

.docs-group-count {
  flex: none;
  padding: 2px 8px;
  border: 1px solid var(--docs-line);
  border-radius: 999px;
  color: var(--docs-muted);
  font: 600 10px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.docs-group-intro {
  max-width: 720px;
  margin: 0 0 22px;
  color: var(--docs-muted);
}

.docs-metric {
  margin: 0 0 16px;
  padding: 20px 22px 21px;
  border: 1px solid var(--docs-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--docs-panel-2), var(--docs-panel));
  scroll-margin-top: 88px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.docs-metric:last-child {
  margin-bottom: 0;
}

.docs-metric:hover {
  border-color: color-mix(in srgb, var(--docs-accent) 34%, var(--docs-line));
  box-shadow: 0 20px 38px -32px #000;
}

.docs-metric h3 {
  margin: 0;
  color: #fff;
  font-size: 15.5px;
  font-weight: 600;
}

.docs-metric h3 a {
  color: inherit;
}

.docs-metric h3 a:hover {
  color: var(--docs-accent);
  text-decoration: none;
}



.docs-metric > p {
  max-width: 760px;
  margin: 8px 0 0;
}

.docs-rule {
  padding: 10px 12px;
  border: 1px solid var(--docs-line);
  border-left: 2px solid color-mix(in srgb, var(--docs-accent) 55%, var(--docs-line));
  border-radius: 0 8px 8px 0;
  background: #0f141d;
  color: #cdd7e6;
  font: 12.5px/1.65 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.docs-metric > .docs-where,
.docs-metric > .docs-caveat {
  margin-top: 12px;
  color: var(--docs-muted);
  font-size: 12.5px;
  line-height: 1.55;
}

.docs-where span,
.docs-caveat span {
  display: inline-block;
  margin-right: 6px;
  color: var(--docs-accent);
  font: 600 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.docs-caveat span {
  color: var(--docs-warn);
}

.docs-limits {
  display: grid;
  gap: 12px;
  max-width: 860px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: limit;
}

.docs-limits li {
  position: relative;
  padding: 16px 18px 16px 54px;
  border: 1px solid var(--docs-line);
  border-radius: 13px;
  background: var(--docs-panel);
  color: var(--docs-muted);
  counter-increment: limit;
}

.docs-limits li::before {
  content: counter(limit, decimal-leading-zero);
  position: absolute;
  top: 17px;
  left: 18px;
  color: var(--docs-warn);
  font: 600 11.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.docs-limits b {
  display: block;
  margin-bottom: 3px;
  color: var(--docs-text);
  font-size: 14px;
}

.docs-sources {
  display: grid;
  gap: 10px;
  max-width: 760px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--docs-muted);
}

.docs-sources li {
  position: relative;
  padding-left: 20px;
}

.docs-sources li::before {
  content: '';
  position: absolute;
  top: 0.68em;
  left: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--docs-accent) 70%, transparent);
}

.docs-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 56px;
  padding-top: 20px;
  border-top: 1px solid var(--docs-line);
  font-size: 13px;
}

.docs-top {
  margin-left: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--docs-muted);
  font: inherit;
}

.docs-top:hover {
  border: 0;
  color: var(--docs-accent);
}

@media (max-width: 860px) {
  .docs {
    padding: 0 20px 72px;
  }

  .docs-hero {
    padding: 34px 0 32px;
  }

  .docs-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .docs-metrics-body {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }

  .docs-toc {
    position: static;
    max-height: none;
    padding: 0 0 20px;
    border-right: 0;
    border-bottom: 1px solid var(--docs-line);
  }

  .docs-toc nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
  }

  .docs-toc-title {
    padding-left: 0;
  }

  .docs-toc-group {
    margin-top: 0;
    padding-left: 0;
  }

  .docs-toc ol {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    border-left: 0;
  }

  .docs-toc li a {
    padding-left: 0;
    border-left: 0;
  }

  .docs-metric {
    padding: 18px 18px 19px;
  }
}

@media (max-width: 520px) {
  .docs-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .docs-top {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .docs *,
  .docs *::before {
    transition: none !important;
  }
}
</style>
