import { CalibrationTable } from './CalibrationTable';

export function DocsCalibration() {
  return (
    <section id="calibration" className="docs-section">
      <h2>Calibration</h2>
      <p className="docs-section-intro">
        A score is only useful if its ranking survives a reasonable change of parameters. The
        calibration script runs the same agents under seven settings and reports how many land in
        each tier, plus Spearman’s rank correlation against the defaults.
      </p>
      <pre>
        <code>bun run calibrate path/to/feedback.json</code>
      </pre>
      <p>
        The input is <code>{`{ "agents": [{ "id": "...", "feedback": [...] }] }`}</code> or a bare
        array. Without a path, the script uses a synthetic demo.
      </p>
      <CalibrationTable />
      <p className="docs-note">
        The demo is synthetic, so read the method rather than the counts. A high ρ means the order
        barely moved; the tier counts can still shift because a threshold sat between two close
        scores. Run this on a real export before treating any threshold as stable.
      </p>
    </section>
  );
}
