import { useParams } from '@tanstack/react-router';
import { useFeedbackDetail } from '../../../shared/lib/explorer';
import { TxDetail } from '../../../shared/ui';
import { FeedbackDetailHeader } from './FeedbackDetailHeader';
import { FeedbackDetailSummary } from './FeedbackDetailSummary';
import { feedbackDetailFallback } from './feedbackDetailFallback';

export function FeedbackDetailPage() {
  const { slug, id, index } = useParams({ from: '/agents/$slug/$id/feedback/$index' });
  const detail = useFeedbackDetail(slug, id, index);
  const name = detail.file?.name ?? `Agent #${id}`;

  const fallback = feedbackDetailFallback({
    query: detail.agentQuery,
    chain: detail.chain,
    agent: detail.agent,
    id,
  });

  if (fallback !== undefined) return fallback;

  if (!detail.chain || !detail.agent || !detail.row) return null;

  return (
    <>
      <FeedbackDetailHeader
        slug={slug}
        id={id}
        name={name}
        chain={detail.chain}
        agent={detail.agent}
        row={detail.row}
      />
      <FeedbackDetailSummary slug={slug} chain={detail.chain} row={detail.row} />
      <p className="meta">
        The transaction detail section explains which validation checks passed and displays a
        progressbar showing the overall check status.
      </p>
      {detail.stats && detail.rowIndex !== undefined ? (
        <TxDetail
          chain={detail.chain}
          agent={detail.agent}
          row={detail.row}
          index={detail.rowIndex}
          stats={detail.stats}
        />
      ) : null}
    </>
  );
}
