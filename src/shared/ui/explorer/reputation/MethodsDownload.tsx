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
        <button type="button" className="btn" onClick={() => downloadInputs(rep, feedback)}>
          Download inputs (JSON)
        </button>
      </p>
    </section>
  );
}
