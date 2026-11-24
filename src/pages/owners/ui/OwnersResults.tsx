import type { OwnerEntry } from '../../../shared/lib/explorer';
import { TableSkeleton } from '../../../shared/ui';
import { OwnersTable } from './OwnersTable';

type Props = {
  owners: OwnerEntry[] | undefined;
  loading: boolean;
  error: string | undefined;
  headers: string[];
  slug: string;
  showNetworks: boolean;
  onRetry: () => void;
};

export function OwnersResults({
  owners,
  loading,
  error,
  headers,
  slug,
  showNetworks,
  onRetry,
}: Props) {
  if (error) {
    return (
      <p className="notice">
        Could not load agents: {error}{' '}
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  }

  if (loading || !owners) {
    return (
      <TableSkeleton
        label="Loading owners"
        headers={headers}
        numeric={['Agents', 'Newest agent']}
      />
    );
  }

  if (owners.length === 0) {
    return <p className="state muted">No owners found in the newest agents.</p>;
  }

  return <OwnersTable owners={owners} slug={slug} showNetworks={showNetworks} />;
}
