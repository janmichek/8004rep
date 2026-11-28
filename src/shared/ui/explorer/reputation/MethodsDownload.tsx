import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import type { Feedback } from '../../../lib/explorer/data/types';
import { downloadInputs } from './methodsDownloadData';

export function MethodsDownload({
  rep,
  feedback,
}: {
  rep: ReputationReport;
  feedback: Feedback[];
}) {
  return (
    <section className="panel">
      <p className="toolbar">
        <button type="button" className="btn" onClick={() => void downloadInputs(rep, feedback)}>
          Download inputs (JSON)
        </button>
      </p>
      <p className="muted note">
        The file carries a SHA-256 of its canonical JSON, with the hash block removed. Re-hash that
        JSON to check the evidence was not edited.
      </p>
    </section>
  );
}
