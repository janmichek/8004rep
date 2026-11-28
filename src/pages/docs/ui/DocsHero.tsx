import { Link } from '@tanstack/react-router';
import {
  CHAINS,
  DEFAULT_CHAIN,
  GLOSSARY_GROUPS,
  METRIC_GROUPS,
} from '../../../shared/lib/explorer';
import { UNIT_WINDOW_DAYS } from '../../../shared/lib/explorer';

const networkCount = CHAINS.length;
const termCount = GLOSSARY_GROUPS.reduce((total, group) => total + group.entries.length, 0);
const metricCount = METRIC_GROUPS.reduce((total, group) => total + group.metrics.length, 0);
const defaultSlug = DEFAULT_CHAIN.slug;

export function DocsHero() {
  return (
    <header className="docs-hero">
      <div className="docs-hero-glow" aria-hidden="true" />
      <p className="docs-kicker">
        <span className="docs-kicker-dot" />
        ERC-8004 reputation, explained
      </p>
      <h1>
        A read-only explorer for ERC-8004 agents and their <em>reputation</em>.
      </h1>
      <p className="docs-lead">
        Every agent on a supported network has an identity and a reputation registry. This app reads
        both, then turns the raw feedback rows into a score you can inspect, argue with and
        recompute. No wallet, no account, no backend: the numbers are calculated in your browser
        from on-chain data and public subgraphs.
      </p>
      <dl className="docs-stats">
        <div>
          <dt>Networks</dt>
          <dd>
            {networkCount}
            <span className="docs-stat-note">mainnets and testnets read directly</span>
          </dd>
        </div>
        <div>
          <dt>Terms</dt>
          <dd>
            {termCount}
            <span className="docs-stat-note">defined in plain language</span>
          </dd>
        </div>
        <div>
          <dt>Metrics</dt>
          <dd>
            {metricCount}
            <span className="docs-stat-note">with rules, sources and caveats</span>
          </dd>
        </div>
        <div>
          <dt>One wallet, one vote</dt>
          <dd>
            1:1
            <span className="docs-stat-note">per tag, per {UNIT_WINDOW_DAYS}-day window</span>
          </dd>
        </div>
      </dl>
      <nav className="docs-jump" aria-label="Start here">
        <a href="#entities">Entities</a>
        <a href="#vocabulary">Vocabulary</a>
        <a href="#how">How it works</a>
        <a href="#sybil">Sybil checks</a>
        <a href="#rules">Rules</a>
        <a href="#metrics">Metric guide</a>
        <a href="#examples">Examples</a>
        <a href="#calibration">Calibration</a>
        <a href="#limits">Limits</a>
        <Link to="/agents/$slug" params={{ slug: defaultSlug }}>
          Browse agents
        </Link>
        <Link to="/network/$slug" params={{ slug: defaultSlug }}>
          Network health
        </Link>
      </nav>
    </header>
  );
}
