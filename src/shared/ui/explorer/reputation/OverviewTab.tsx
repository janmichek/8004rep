import type { FeedbackStats } from '../../../lib/explorer/data/feedbackStats';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import type { TrustReport } from '../../../lib/explorer/data/trustReport';
import type { Feedback } from '../../../lib/explorer/data/types';
import { OverviewCharts } from './OverviewCharts';
import { OverviewKinds } from './OverviewKinds';
import { OverviewSignals } from './OverviewSignals';
import { OverviewTelemetry } from './OverviewTelemetry';
import { OverviewWaterfall } from './OverviewWaterfall';

type Props = {
  feedback: Feedback[];
  stats: FeedbackStats;
  report: TrustReport;
  rep: ReputationReport;
};

export function OverviewTab({ feedback, stats, report, rep }: Props) {
  return (
    <div className="overview">
      <OverviewSignals stats={stats} rep={rep} />
      <OverviewCharts feedback={feedback} stats={stats} rep={rep} />
      <OverviewKinds rep={rep} />
      <OverviewWaterfall rep={rep} report={report} stats={stats} />
      <OverviewTelemetry rep={rep} />
    </div>
  );
}
