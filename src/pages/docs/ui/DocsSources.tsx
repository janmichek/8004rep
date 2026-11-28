export function DocsSources() {
  return (
    <section id="sources" className="docs-section">
      <h2>Sources</h2>
      <ul className="docs-sources">
        <li>
          ERC-8004 identity and reputation events, indexed on-chain into 8004rep’s PostgreSQL index.
        </li>
        <li>
          Registration files resolved by the indexer through an SSRF-guarded fetcher; the browser
          resolves files for chains that are not indexed yet.
        </li>
        <li>
          The agent0 public subgraphs and RPC, used only as a fallback before a chain is synced.
        </li>
        <li>8004scan’s public API, kept strictly for the comparison tile and “vs 8004scan” tab.</li>
      </ul>
      <p className="docs-note">
        The explorer reads its own index; 8004scan is a comparison value, not a data source. There
        is no account to create and nothing to connect.
      </p>
    </section>
  );
}
