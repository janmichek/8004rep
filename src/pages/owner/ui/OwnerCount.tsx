import { ownerScale } from '../../../shared/lib/explorer';
import { Skeleton } from '../../../shared/ui';

export function OwnerCount({
  owned,
  loading,
  dataPresent,
}: {
  owned: number | undefined;
  loading: boolean;
  dataPresent: boolean;
}) {
  if (loading || !dataPresent) {
    return (
      <span>
        <Skeleton width="4.2em" height="1.35em" radius="999px" />
      </span>
    );
  }

  if (owned === undefined) return null;

  const scale = ownerScale(owned);

  return (
    <span className={`chip ${scale?.level === 'warn' ? 'warn' : ''}`} title={scale?.rule}>
      {owned} {owned === 1 ? 'agent' : 'agents'}
      {scale && scale.bracket !== 'single' ? ` · ${scale.label}` : ''}
    </span>
  );
}
