import type { ChainFailure } from '../../../shared/lib/explorer';
import { TableSkeleton } from '../../../shared/ui';

type Props = {
  failed: ChainFailure[];
  loaded: boolean;
  error: string | undefined;
  headers: string[];
  onRetry: () => void;
};

export function ReviewersStatus({ failed, loaded, error, headers, onRetry }: Props) {
  return (
    <>
      {failed.length > 0 && loaded ? (
        <p className="notice">
          Could not load feedback on {failed.map((failure) => failure.chain.name).join(', ')}; those
          networks are left out.
        </p>
      ) : null}

      {error ? (
        <p className="notice">
          Could not load feedback: {error}{' '}
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </p>
      ) : null}

      {!error && !loaded ? (
        <TableSkeleton
          label="Loading reviewers"
          headers={headers}
          numeric={['Reviews', 'Agents', 'Average']}
        />
      ) : null}
    </>
  );
}
