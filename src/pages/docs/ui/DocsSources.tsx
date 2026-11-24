export function DocsSources() {
  return (
    <section id="sources" className="docs-section">
      <h2>Sources</h2>
      <ul className="docs-sources">
        <li>ERC-8004 identity and reputation registries, read over public RPC endpoints.</li>
        <li>The agent0 public subgraphs, where the chain has one.</li>
        <li>Registration files served by agents themselves, for services and metadata.</li>
        <li>8004scan’s public API, used only for comparison and scan-only agents.</li>
      </ul>
      <p className="docs-note">
        The app is open source and runs entirely client-side. There is no account to create and
        nothing to connect.
      </p>
    </section>
  );
}
