import { DocsSybil } from './DocsSybil';

export function DocsHow() {
  return (
    <section id="how" className="docs-section">
      <h2>How it works</h2>
      <p className="docs-section-intro">
        Three passes turn raw registry rows into a number you can defend: collect, classify, then
        show every step.
      </p>
      <ol className="docs-steps">
        <li>
          <b>Read the registries.</b>
          <span>
            Identity and reputation events come from the ERC-8004 contracts, with the agent0
            subgraph filling in metadata and names where a network has one. Chains without a
            subgraph are read over RPC only.
          </span>
        </li>
        <li>
          <b>Classify every row.</b>
          <span>
            A value can be a rating, an outcome, a telemetry reading or a quantity. Only ratings are
            normalised, collapsed into one vote per wallet, tag and 30-day window, and allowed into
            the score.
          </span>
        </li>
        <li>
          <b>Show the working.</b>
          <span>
            The score is a conservative average with a neutral prior. Every input, weight, flag and
            alternative number is on the page, and the Methods tab can download the exact inputs as
            JSON.
          </span>
        </li>
      </ol>
      <p className="docs-note">
        The explorer is a lens, not an oracle. A high score means “this much independent rating
        evidence points here”, not “this agent is safe to use”. Read the evidence alongside the
        number.
      </p>

      <DocsSybil />
    </section>
  );
}
