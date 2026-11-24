import { useMemo } from 'react';
import { ColumnChart } from '../../../shared/ui';
import { COUNT_SERIES } from '../../../shared/ui';
import { dailyColumns, valueHistogram } from '../../../shared/lib/explorer';
import type { FeedbackEvent } from '../../../shared/lib/explorer';
import type { NetworkStats } from '../../../shared/lib/explorer';

const VOLUME_SERIES = [
  { key: 'clean', label: 'live', color: COUNT_SERIES[0]?.color ?? '#3987e5' },
  { key: 'revoked', label: 'revoked', color: '#5b6472' },
];

export function NetworkCharts({ items, stats }: { items: FeedbackEvent[]; stats: NetworkStats }) {
  const volume = useMemo(
    () =>
      dailyColumns(
        items,
        (row) => row.createdAt,
        (row) => (row.revoked ? 'revoked' : 'clean'),
        ['clean', 'revoked'],
        { clean: 'live', revoked: 'revoked' }
      ),
    [items]
  );

  const distribution = useMemo(() => valueHistogram(stats.ratingValues), [stats.ratingValues]);

  return (
    <div className="chart-grid">
      <ColumnChart title="Feedback volume" columns={volume} series={VOLUME_SERIES} />
      <ColumnChart
        title="Rating values, normalised"
        columns={distribution}
        series={COUNT_SERIES}
        marker={stats.average !== null ? { at: stats.average, label: 'network avg' } : undefined}
      />
    </div>
  );
}
