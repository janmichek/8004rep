import { useMemo } from 'react';
import { dailyColumns, valueHistogram, type FeedbackEvent } from '../../../shared/lib/explorer';
import { COUNT_SERIES, ColumnChart } from '../../../shared/ui';

type Props = { ratingValues: number[]; items: FeedbackEvent[] };

export function ReviewerCharts({ ratingValues, items }: Props) {
  const valueColumns = useMemo(() => valueHistogram(ratingValues), [ratingValues]);

  const timeColumns = useMemo(
    () =>
      dailyColumns(
        items,
        (row) => row.createdAt,
        () => 'count',
        ['count'],
        { count: 'feedback' }
      ),
    [items]
  );

  return (
    <div className="chart-grid">
      <ColumnChart
        title="Ratings it gave, normalised"
        columns={valueColumns}
        series={COUNT_SERIES}
      />
      <ColumnChart title="Feedback over time" columns={timeColumns} series={COUNT_SERIES} />
    </div>
  );
}
