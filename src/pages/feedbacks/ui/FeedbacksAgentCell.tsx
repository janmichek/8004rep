import type { FeedbackEvent } from '../../../shared/lib/explorer';

export function FeedbacksAgentCell({ row }: { row: FeedbackEvent }) {
  return (
    <td>
      {row.agentName ?? `Agent #${row.tokenId}`}{' '}
      <small className="muted">#{row.tokenId.toString()}</small>
    </td>
  );
}
