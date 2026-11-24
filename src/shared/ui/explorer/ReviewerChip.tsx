import { Files, Stamp, ThumbsDown, UserRound, Users, type LucideIcon } from 'lucide-react';
import { LABEL_INFO, type ReviewerLabel } from '../../lib/explorer/data/reviewerProfile';

const ICONS: Record<ReviewerLabel, LucideIcon> = {
  'rubber-stamp': Stamp,
  'single-agent': UserRound,
  bulk: Files,
  mass: Users,
  harsh: ThumbsDown,
};

export function ReviewerChip({ label }: { label: ReviewerLabel }) {
  const Icon = ICONS[label];

  return (
    <span className={`chip reviewer-chip reviewer-${label}`}>
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {LABEL_INFO[label].label}
    </span>
  );
}
