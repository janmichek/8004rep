import {
  Activity,
  Ban,
  Copy,
  Crosshair,
  Link2Off,
  Repeat2,
  Ruler,
  UserX,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { FLAG_INFO, type RowFlag } from '../../lib/explorer/data/feedbackStats';

const ICONS: Record<RowFlag, LucideIcon> = {
  revoked: Ban,
  self: UserX,
  duplicate: Copy,
  burst: Zap,
  monotonous: Repeat2,
  hyperactive: Activity,
  outlier: Crosshair,
  'out-of-range': Ruler,
  'unlisted-endpoint': Link2Off,
};

export function FlagChip({ flag }: { flag: RowFlag }) {
  const Icon = ICONS[flag];

  return (
    <span className={`chip flag-chip flag-${flag}`}>
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {FLAG_INFO[flag].label}
    </span>
  );
}
