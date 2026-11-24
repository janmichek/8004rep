export function DocsLimits() {
  return (
    <section id="limits" className="docs-section">
      <h2>What it cannot see</h2>
      <p className="docs-section-intro">
        A score is only as good as the evidence behind it. These are the gaps the page will not
        paper over.
      </p>
      <ul className="docs-limits">
        <li>
          <b>On-chain feedback are only as independent as their wallets.</b>
          Fresh wallets that each rate once at varied values pass every rule. Shared funding is the
          check for that, and “cost to fake” prices the effort.
        </li>
        <li>
          <b>Text is not judged.</b>
          The registries hold no feedback to read beyond a URI. A feedback file can point to a
          comment, a task or a payment proof, but this app does not fetch or grade its prose.
        </li>
        <li>
          <b>One window of history.</b>
          RPC log scans and source caps limit how far back the page reads. When a total is larger
          than the rows held, the page says how many feedback the computation actually used.
        </li>
        <li>
          <b>Availability changes the view.</b>
          If a subgraph or RPC endpoint is unavailable, the source badge says so and the data falls
          back or stops. Empty is not the same as zero.
        </li>
        <li>
          <b>Not a security audit.</b>
          The page reports reputation evidence for a specific agent. It does not audit the agent’s
          code, permissions or funds.
        </li>
      </ul>
    </section>
  );
}
