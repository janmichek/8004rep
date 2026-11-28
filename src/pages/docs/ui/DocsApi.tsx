export function DocsApi() {
  return (
    <section id="api" className="docs-section">
      <h2>API and published formula</h2>
      <p className="docs-section-intro">
        The score is not a private ranking. The formula, parameters and every input are published,
        and the same report the page renders is available as JSON.
      </p>
      <pre>
        <code>{`curl https://8004rep.example/api/reputation/spec
curl https://8004rep.example/api/agents/8453/1
curl https://8004rep.example/api/agents/8453/1/reputation`}</code>
      </pre>
      <p>
        <code>GET /api/reputation/spec</code> returns the versioned formula: prior strength
        <code>alpha0: 3</code>, neutral mean <code>mu0: 0.5</code>, the 30-day unit window, the
        90-day half-life, the confidence thresholds, the tag taxonomy and the seven waterfall steps.
        It is cached as immutable per formula version.
      </p>
      <p>
        <code>GET /api/agents/&#123;chainId&#125;/&#123;tokenId&#125;/reputation</code> returns the
        filtered score, its 80% credible interval, confidence, cost to fake, funnel, concentration,
        contributions, waterfall, counts, telemetry, findings and responsiveness, plus the
        chain-wide tag scales and a SHA-256 <code>contentHash</code> over canonical inputs. Hash the
        same canonical JSON to verify a report.
      </p>
      <p>
        The full written contract is{' '}
        <a
          href="https://github.com/janmichek/8004rep/blob/main/docs/reputation-spec-v1.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          docs/reputation-spec-v1
        </a>
        ; the implementation is <code>shared/reputation</code>, the same module the indexer and the
        browser run. The OpenAPI document is generated from <code>shared/schemas.ts</code>.
      </p>
      <p className="docs-note">
        8004scan still appears on the agent page, but only as a comparison tile and the “vs
        8004scan” tab. It does not feed the list, the network totals or the ranking.
      </p>
    </section>
  );
}
