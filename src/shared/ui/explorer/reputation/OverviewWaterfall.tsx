import type { FeedbackStats } from '../../../lib/explorer/data/feedbackStats';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import type { TrustReport } from '../../../lib/explorer/data/trustReport';
import { OverviewEvidencePanel } from './OverviewEvidencePanel';
import { OverviewWaterfallPanel } from './OverviewWaterfallPanel';

export function OverviewWaterfall({
  rep,
  report,
  stats,
}: {
  rep: ReputationReport;
  report: TrustReport;
  stats: FeedbackStats;
}) {
  return (
    <div className="chart-grid">
      <OverviewWaterfallPanel rep={rep} />
      <OverviewEvidencePanel report={report} stats={stats} />
    </div>
  );
}
