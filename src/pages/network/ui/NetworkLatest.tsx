import type { ChainInfo, FeedbackEvent } from '../../../shared/lib/explorer';
import { useSort } from '../../../shared/lib/explorer';
import { SortHeaderRow, latestFeedbackColumns } from '../../../shared/ui';
import { NetworkLatestRow } from './NetworkLatestRow';

export function NetworkLatest({ rows, chain }: { rows: FeedbackEvent[]; chain: ChainInfo }) {
  const { sorted, state, toggle } = useSort(rows, [
    { key: 'agent', value: (row) => row.agentName ?? `Agent #${row.tokenId}` },
    { key: 'reviewer', value: (row) => row.client },
    { key: 'value', value: (row) => row.value, numeric: true },
    { key: 'when', value: (row) => row.createdAt, numeric: true },
  ]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <SortHeaderRow columns={latestFeedbackColumns(true)} state={state} toggle={toggle} />
        </thead>
        <tbody>
          {sorted.slice(0, 100).map((row) => (
            <NetworkLatestRow
              key={`${row.chainId ?? 0}:${row.tokenId}:${row.client}:${row.index ?? row.feedbackURI ?? 'row'}`}
              row={row}
              chain={chain}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
