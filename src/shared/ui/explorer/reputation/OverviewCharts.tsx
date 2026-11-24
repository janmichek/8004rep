import { dailyColumns, valueHistogram } from '../../../lib/explorer/data/chartData';
import type { FeedbackStats } from '../../../lib/explorer/data/feedbackStats';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import type { Feedback } from '../../../lib/explorer/data/types';
import { ActivityGrid } from '../ActivityGrid';
import { ColumnChart } from '../ColumnChart';
import { COUNT_SERIES } from '../palette';

const ACTIVITY_SERIES = [
  { key: 'rating', label: 'scored rating', color: '#0ca30c' },
  { key: 'other', label: 'not scored', color: '#3987e5' },
  { key: 'revoked', label: 'revoked', color: '#5b6472' },
];

export function OverviewCharts({
  feedback,
  stats,
  rep,
}: {
  feedback: Feedback[];
  stats: FeedbackStats;
  rep: ReputationReport;
}) {
  const activity = dailyColumns(
    feedback.map((row, index) => ({
      row,
      kind: stats.rows[index]?.kind,
      rating: stats.rows[index]?.rating,
    })),
    (item) => item.row.createdAt,
    (item) => {
      if (item.row.revoked) return 'revoked';

      if (item.kind === 'rating' && item.rating !== null) return 'rating';

      return 'other';
    },
    ACTIVITY_SERIES.map((series) => series.key),
    Object.fromEntries(ACTIVITY_SERIES.map((series) => [series.key, series.label]))
  );

  const undated = feedback.filter((row) => row.createdAt === undefined).length;

  const datedTimes = feedback.flatMap((row) =>
    row.createdAt === undefined ? [] : [row.createdAt]
  );

  const distribution = valueHistogram(
    rep.layer.classified.flatMap((classified, index) =>
      !feedback[index]?.revoked && classified.kind === 'rating' && classified.r !== null
        ? [classified.r * 100]
        : []
    ),
    'rating'
  );

  return (
    <>
      <ActivityGrid label="Activity" times={datedTimes} />
      <div className="chart-grid">
        <ColumnChart title="Feedback over time" columns={activity} series={ACTIVITY_SERIES} />
        <ColumnChart
          title="Rating values, normalised"
          columns={distribution}
          series={COUNT_SERIES}
        />
      </div>
      {undated > 0 ? (
        <p className="muted note">
          {undated} row{undated === 1 ? ' has' : 's have'} no date and{' '}
          {undated === 1 ? 'is' : 'are'} left out of the time chart.
        </p>
      ) : null}
    </>
  );
}
