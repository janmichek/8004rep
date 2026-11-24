import { DocsConfidence } from './DocsConfidence';
import { DocsFlags } from './DocsFlags';
import { DocsLabels } from './DocsLabels';

export function DocsRules() {
  return (
    <section id="rules" className="docs-section">
      <h2>Rules on feedback and reviewers</h2>
      <p className="docs-section-intro">
        These are the rules applied to every row and every reviewer. They are stated here once; the
        agent page&apos;s Methods tab links back instead of repeating them.
      </p>

      <h3 className="docs-subhead">Rules on each feedback row</h3>
      <DocsFlags />

      <h3 className="docs-subhead">Rules on a reviewer</h3>
      <DocsLabels />

      <h3 className="docs-subhead">Confidence levels</h3>
      <DocsConfidence />

      <p className="docs-note">
        Everything is computed in your browser from on-chain rows. No IP, device or text signals
        exist on-chain; a reviewer with many fresh wallets that each rate once at varied values
        passes every rule. Shared funders on the Reviewers tab are the check for that.
      </p>
    </section>
  );
}
