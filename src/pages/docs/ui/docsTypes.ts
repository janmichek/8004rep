import { METRIC_GROUPS } from '../../../shared/lib/explorer';

export type GuideGroup = (typeof METRIC_GROUPS)[number];

export type GuideMetric = GuideGroup['metrics'][number];
