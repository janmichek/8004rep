import { formatScore, type ChainInfo, type FeedbackEvent } from '../../../shared/lib/explorer';
import {
  FeedbackFileCell,
  FeedbackTagsCell,
  FeedbackTextCell,
  FeedbackWhenCell,
} from '../../../shared/ui';

type Props = {
  row: FeedbackEvent;
  chain: ChainInfo;
  onOpen: (tokenId: bigint, event?: { target: EventTarget | null }) => void;
};

export function ReviewerFeedbackRow({ row, chain, onOpen }: Props) {
  return (
    <tr
      className={`row-link${row.revoked ? ' revoked' : ''}`}
      role="link"
      tabIndex={0}
      aria-label={`Open ${row.agentName ?? `Agent #${row.tokenId}`}`}
      onClick={(event) => onOpen(row.tokenId, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(row.tokenId);
        }
      }}
    >
      <td>{row.agentName ?? `Agent #${row.tokenId}`}</td>
      <td className="num">
        <b>{formatScore(row.value)}</b>
        {row.revoked ? (
          <>
            {' '}
            <span className="chip">revoked</span>
          </>
        ) : null}
      </td>
      <FeedbackTagsCell row={row} />
      <FeedbackTextCell row={row} />
      <FeedbackFileCell row={row} />
      <FeedbackWhenCell createdAt={row.createdAt} chain={chain} txHash={row.txHash} />
    </tr>
  );
}
