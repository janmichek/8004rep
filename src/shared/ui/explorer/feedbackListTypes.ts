import type { RowStats } from '../../lib/explorer/data/feedbackStats';
import type { Feedback } from '../../lib/explorer/data/types';

export type ListRow = { row: Feedback; stats?: RowStats | undefined; index: number };
