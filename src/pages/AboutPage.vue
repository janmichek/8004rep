<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CHAINS, DEFAULT_CHAIN } from '../chains'
import { GLOSSARY_GROUPS } from '../data/glossary'
import { METRIC_GROUPS } from '../data/metricsGuide'

const copied = ref<string | null>(null)

const mainnets = computed(() => CHAINS.filter((chain) => !chain.testnet))
const testnets = computed(() => CHAINS.filter((chain) => chain.testnet))
const defaultSlug = DEFAULT_CHAIN.slug

function href(id: string): string {
  return `#/about#${id}`
}

async function copyLink(id: string): Promise<void> {
  const url = `${location.origin}${location.pathname}${href(id)}`
  try {
    await navigator.clipboard.writeText(url)
    copied.value = id
    setTimeout(() => {
      if (copied.value === id) copied.value = null
    }, 1600)
  } catch {
    copied.value = null
  }
}
</script>

<template>
  <div class="about">
    <header class="about-hero">
      <p class="about-kicker">8004rep</p>
      <h1>A read-only explorer for ERC-8004 agents and their reputation.</h1>
      <p class="about-lead">
        Every agent on a supported network has an identity and a reputation registry. This app reads both, then turns the
        raw feedback rows into a score you can inspect, argue with and recompute. No wallet, no account, no backend: the
        numbers are calculated in your browser from on-chain data and public subgraphs.
      </p>
      <nav class="about-jump" aria-label="Start here">
        <a :href="href('entities')">Entities</a>
        <a :href="href('vocabulary')">Vocabulary</a>
        <a :href="href('how')">How it works</a>
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
      class="about-section about-glossary"
    >
      <h2>{{ group.title }}</h2>
      <p>{{ group.intro }}</p>
      <dl class="about-glossary-list">
        <div v-for="entry in group.entries" :id="entry.id" :key="entry.id" class="about-glossary-item">
          <dt>
            <a :href="href(entry.id)" :title="`Link to ${entry.name}`">{{ entry.name }}</a>
            <button type="button" class="about-copy" @click="copyLink(entry.id)">
              {{ copied === entry.id ? 'link copied' : 'copy link' }}
            </button>
          </dt>
          <dd>
            {{ entry.summary }}
            <a v-if="entry.seeAlso" class="about-glossary-see" :href="href(entry.seeAlso)">See metric</a>
          </dd>
        </div>
      </dl>
    </section>

    <section id="how" class="about-section">
      <h2>How it works</h2>
      <ol class="about-steps">
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
      <p class="about-note">
        The explorer is a lens, not an oracle. A high score means “this much independent rating evidence points here”, not
        “this agent is safe to use”. Read the evidence alongside the number.
      </p>
    </section>

    <section id="coverage" class="about-section">
      <h2>Networks</h2>
      <p>
        The same registry addresses are used per chain family. Mainnets and testnets are read separately, and the switch in
        the header only changes which environment you are looking at.
      </p>
      <div class="about-chains">
        <div>
          <h3>Mainnet</h3>
          <ul>
            <li v-for="chain in mainnets" :key="chain.chainId">
              <RouterLink :to="{ name: 'agents', params: { slug: chain.slug } }">{{ chain.name }}</RouterLink>
            </li>
          </ul>
        </div>
        <div>
          <h3>Testnet</h3>
          <ul>
            <li v-for="chain in testnets" :key="chain.chainId">
              <RouterLink :to="{ name: 'agents', params: { slug: chain.slug } }">{{ chain.name }}</RouterLink>
            </li>
          </ul>
        </div>
      </div>
      <p class="about-note">
        Some chains have no chain configuration yet. Those agents are still reachable through 8004scan links and are shown
        on their scan page rather than being scored locally.
      </p>
    </section>

    <section id="metrics" class="about-section about-metrics">
      <div class="about-metrics-head">
        <h2>Metric guide</h2>
        <p>
          Every metric has a permanent anchor. When a tooltip, chip or number needs to explain itself later, it can link
          to the matching paragraph with <code>{ name: 'about', hash: '#id' }</code>.
        </p>
      </div>

      <div class="about-metrics-body">
        <aside class="about-toc" aria-label="Metrics">
          <nav>
            <template v-for="group in METRIC_GROUPS" :key="group.id">
              <a class="about-toc-group" :href="href(group.id)">{{ group.title }}</a>
              <ol>
                <li v-for="metric in group.metrics" :key="metric.id">
                  <a :href="href(metric.id)">{{ metric.name }}</a>
                </li>
              </ol>
            </template>
          </nav>
        </aside>

        <div class="about-groups">
          <section v-for="group in METRIC_GROUPS" :id="group.id" :key="group.id" class="about-group">
            <h2>{{ group.title }}</h2>
            <p class="about-group-intro">{{ group.intro }}</p>

            <article v-for="metric in group.metrics" :id="metric.id" :key="metric.id" class="about-metric">
              <div class="about-metric-head">
                <h3>
                  <a :href="href(metric.id)" :title="`Link to ${metric.name}`">{{ metric.name }}</a>
                </h3>
                <button type="button" class="about-copy" @click="copyLink(metric.id)">
                  {{ copied === metric.id ? 'link copied' : 'copy link' }}
                </button>
              </div>
              <p>{{ metric.summary }}</p>
              <p v-if="metric.rule" class="about-rule">{{ metric.rule }}</p>
              <p v-if="metric.where" class="about-where"><span>Seen in</span> {{ metric.where }}</p>
              <p v-if="metric.caveat" class="about-caveat"><span>Worth knowing</span> {{ metric.caveat }}</p>
            </article>
          </section>
        </div>
      </div>
    </section>

    <section id="limits" class="about-section">
      <h2>What it cannot see</h2>
      <ul class="about-limits">
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

    <section id="sources" class="about-section">
      <h2>Sources</h2>
      <ul class="about-sources">
        <li>ERC-8004 identity and reputation registries, read over public RPC endpoints.</li>
        <li>The agent0 public subgraphs, where the chain has one.</li>
        <li>Registration files served by agents themselves, for services and metadata.</li>
        <li>8004scan’s public API, used only for comparison and scan-only agents.</li>
      </ul>
      <p class="about-note">
        The app is open source and runs entirely client-side. There is no account to create and nothing to connect.
      </p>
    </section>

    <footer class="about-footer">
      <RouterLink :to="{ name: 'agents', params: { slug: defaultSlug } }">Agents</RouterLink>
      <RouterLink :to="{ name: 'network', params: { slug: defaultSlug } }">Network health</RouterLink>
      <a :href="href('metrics')">Back to the metric guide</a>
    </footer>
  </div>
</template>

<style scoped>
.about {
  --about-bg: #0b0e13;
  --about-panel: #121722;
  --about-panel-2: #171e2b;
  --about-line: #27303f;
  --about-text: #e2e8f2;
  --about-muted: #93a0b4;
  --about-accent: #5eead4;
  --about-link: #93b8ff;
  --about-warn: #f5b84b;
  max-width: 1180px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  background: var(--about-bg);
  border-radius: 14px;
  color: var(--about-text);
  font: 14px/1.65 system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.about a {
  color: var(--about-link);
  text-decoration: none;
}

.about a:hover {
  text-decoration: underline;
}

.about code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #0a0e15;
  border: 1px solid var(--about-line);
  color: var(--about-accent);
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.about-hero {
  padding: 14px 0 34px;
  border-bottom: 1px solid var(--about-line);
}

.about-kicker {
  margin: 0 0 10px;
  color: var(--about-accent);
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.about h1 {
  max-width: 820px;
  margin: 0;
  color: #fff;
  font-size: clamp(28px, 4vw, 44px);
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.about-lead {
  max-width: 780px;
  margin: 18px 0 0;
  color: var(--about-muted);
  font-size: 16px;
}

.about-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 22px;
  font-size: 13px;
}

.about-jump a {
  padding: 5px 0;
  border-bottom: 1px solid var(--about-line);
}

.about-section {
  padding-top: 38px;
}

.about-section > h2,
.about-metrics-head h2 {
  margin: 0 0 14px;
  color: #fff;
  font-size: 22px;
  letter-spacing: -0.01em;
}

.about-section > p {
  max-width: 780px;
  margin: 0 0 16px;
  color: var(--about-muted);
}

.about-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

.about-steps li {
  position: relative;
  padding: 18px 18px 18px 54px;
  border: 1px solid var(--about-line);
  border-radius: 12px;
  background: var(--about-panel);
  counter-increment: step;
}

.about-steps li::before {
  content: counter(step, decimal-leading-zero);
  position: absolute;
  top: 18px;
  left: 18px;
  color: var(--about-accent);
  font: 600 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.about-steps b {
  display: block;
  margin-bottom: 6px;
  color: #fff;
  font-size: 14px;
}

.about-steps span {
  color: var(--about-muted);
  font-size: 13px;
}

.about-note {
  max-width: 780px;
  margin: 18px 0 0;
  padding: 12px 14px;
  border-left: 2px solid var(--about-warn);
  border-radius: 0 8px 8px 0;
  background: color-mix(in srgb, var(--about-warn) 8%, transparent);
  color: var(--about-muted);
  font-size: 13px;
}

.about-chains {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.about-chains > div {
  padding: 16px 18px;
  border: 1px solid var(--about-line);
  border-radius: 12px;
  background: var(--about-panel);
}

.about-chains h3 {
  margin: 0 0 8px;
  color: #fff;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.about-chains ul {
  margin: 0;
  padding-left: 18px;
  color: var(--about-muted);
}

.about-chains li + li {
  margin-top: 3px;
}

.about-glossary-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin: 0;
}

.about-glossary-item {
  padding: 14px 16px;
  border: 1px solid var(--about-line);
  border-radius: 12px;
  background: var(--about-panel);
}

.about-glossary-item dt {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 6px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.about-glossary-item dt a {
  color: #fff;
  text-decoration: none;
}

.about-glossary-item dt a:hover {
  color: var(--about-accent);
}

.about-glossary-item .about-copy {
  opacity: 0;
}

.about-glossary-item:hover .about-copy,
.about-glossary-item .about-copy:focus-visible {
  opacity: 1;
}

.about-glossary-item dd {
  margin: 0;
  color: var(--about-muted);
  font-size: 13px;
  line-height: 1.45;
}

.about-glossary-see {
  display: inline-block;
  margin-left: 6px;
  font-size: 12px;
  white-space: nowrap;
}

.about-metrics-body {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 36px;
  align-items: start;
}

.about-toc {
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 110px);
  overflow: auto;
  padding-right: 8px;
  border-right: 1px solid var(--about-line);
  scrollbar-width: thin;
}

.about-toc-group {
  display: block;
  margin-top: 14px;
  color: var(--about-muted);
  font: 600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-toc-group:first-child {
  margin-top: 0;
}

.about-toc ol {
  margin: 5px 0 0;
  padding: 0 0 0 14px;
  list-style: none;
  border-left: 1px solid var(--about-line);
}

.about-toc li {
  margin: 2px 0;
}

.about-toc li a {
  display: block;
  padding: 2px 0;
  color: var(--about-text);
  font-size: 12.5px;
  opacity: 0.78;
}

.about-toc li a:hover {
  opacity: 1;
  text-decoration: none;
}

.about-groups {
  min-width: 0;
}

.about-group {
  padding: 0 0 30px;
  scroll-margin-top: 84px;
}

.about-group + .about-group {
  padding-top: 8px;
  border-top: 1px solid var(--about-line);
}

.about-group h2 {
  margin: 26px 0 8px;
  color: #fff;
  font-size: 19px;
}

.about-group-intro {
  max-width: 720px;
  margin: 0 0 18px;
  color: var(--about-muted);
}

.about-metric {
  padding: 16px 0;
  border-top: 1px solid color-mix(in srgb, var(--about-line) 70%, transparent);
  scroll-margin-top: 84px;
}

.about-metric:first-of-type {
  border-top: 0;
}

.about-metric-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.about-metric h3 {
  margin: 0;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.about-metric h3 a {
  color: inherit;
}

.about-metric h3 a:hover {
  color: var(--about-accent);
  text-decoration: none;
}

.about-copy {
  flex: none;
  padding: 3px 8px;
  border: 1px solid var(--about-line);
  border-radius: 999px;
  background: transparent;
  color: var(--about-muted);
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease;
}

.about-metric:hover .about-copy,
.about-copy:focus-visible {
  opacity: 1;
}

.about-copy:hover {
  color: var(--about-text);
  border-color: var(--about-muted);
}

.about-metric > p {
  max-width: 760px;
  margin: 6px 0 0;
}

.about-rule {
  padding: 8px 10px;
  border: 1px solid var(--about-line);
  border-radius: 8px;
  background: var(--about-panel-2);
  color: #cdd7e6;
  font: 12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.about-where,
.about-caveat {
  color: var(--about-muted);
  font-size: 12.5px;
}

.about-where span,
.about-caveat span {
  display: inline-block;
  margin-right: 6px;
  color: var(--about-accent);
  font: 600 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.about-caveat span {
  color: var(--about-warn);
}

.about-limits {
  max-width: 820px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.about-limits li {
  padding: 12px 0;
  border-top: 1px solid var(--about-line);
  color: var(--about-muted);
}

.about-limits b {
  color: var(--about-text);
}

.about-sources {
  max-width: 760px;
  margin: 0;
  padding-left: 20px;
  color: var(--about-muted);
}

.about-sources li + li {
  margin-top: 6px;
}

.about-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 48px;
  padding-top: 18px;
  border-top: 1px solid var(--about-line);
  font-size: 13px;
}

@media (max-width: 860px) {
  .about-metrics-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .about-toc {
    position: static;
    max-height: none;
    padding: 0 0 16px;
    border-right: 0;
    border-bottom: 1px solid var(--about-line);
  }

  .about-toc nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
  }

  .about-toc-group {
    margin-top: 0;
  }

  .about-toc ol {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 12px;
    padding-left: 0;
    border-left: 0;
  }

  .about-copy {
    opacity: 1;
  }
}
</style>
