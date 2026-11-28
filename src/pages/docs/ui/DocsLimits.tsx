const LIMITS = [
  {
    title: 'On-chain feedback are only as independent as their wallets.',
    body: 'Fresh wallets that each rate once at varied values pass every rule. Shared funding is the check for that, and “cost to fake” prices the effort.',
  },
  {
    title: 'Text is not judged.',
    body: 'The registries hold no feedback to read beyond a URI. A feedback file can point to a comment, a task or a payment proof, but this app does not fetch or grade its prose.',
  },
  {
    title: 'Index coverage varies by chain.',
    body: 'Each chain advances at its own pace and backfills from its registry deployment. Until a chain is synced, the page falls back to the subgraph or RPC, and the response says which source it used.',
  },
  {
    title: 'Availability changes the view.',
    body: 'If the indexer, database, subgraph or RPC is unavailable, the source badge says so and the data falls back or stops. Empty is not the same as zero.',
  },
  {
    title: 'Owner scale is context, not proof.',
    body: 'A platform can legitimately hold hundreds of agents. The mass-registrant bracket calls attention to the count; it never changes the filtered score.',
  },
  {
    title: 'Liveness is a header check.',
    body: 'A probe reports whether an endpoint answered, not whether it returned the right answer. A 200 from a placeholder page passes.',
  },
  {
    title: 'Metadata clones see one page.',
    body: 'The owner page compares the current page of agents (up to 25), not the owner’s whole portfolio. A shared template is common and is not called fraud.',
  },
  {
    title: 'Calibration is only as good as the sample.',
    body: 'The bundled demo is synthetic. Rank correlation on a real export is the useful number.',
  },
  {
    title: 'Not a security audit.',
    body: 'The page reports reputation evidence for a specific agent. It does not audit the agent’s code, permissions or funds.',
  },
];

export function DocsLimits() {
  return (
    <section id="limits" className="docs-section">
      <h2>What it cannot see</h2>
      <p className="docs-section-intro">
        A score is only as good as the evidence behind it. These are the gaps the page will not
        paper over.
      </p>
      <ul className="docs-limits">
        {LIMITS.map((limit) => (
          <li key={limit.title}>
            <b>{limit.title}</b>
            {limit.body}
          </li>
        ))}
      </ul>
    </section>
  );
}
