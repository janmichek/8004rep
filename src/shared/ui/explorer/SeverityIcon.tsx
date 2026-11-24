import { CircleAlert, Info, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { RiskLevel } from '../../lib/explorer/data/feedbackStats';

type Level = RiskLevel | 'clean';

const ICONS: Record<Level, LucideIcon> = {
  high: TriangleAlert,
  warn: CircleAlert,
  info: Info,
  clean: ShieldCheck,
};

const WORDS: Record<Level, string> = {
  high: 'High risk',
  warn: 'Needs a look',
  info: 'Notes only',
  clean: 'No findings',
};

export function SeverityIcon({ level }: { level: Level }) {
  const Icon = ICONS[level];

  return (
    <span className="severity-icon" title={WORDS[level]} role="img" aria-label={WORDS[level]}>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
