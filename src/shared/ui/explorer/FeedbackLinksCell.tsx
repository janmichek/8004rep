import { txExplorerUrl } from '../../lib/explorer';
import type { ChainInfo } from '../../lib/explorer';
import type { Feedback } from '../../lib/explorer/data/types';
import { evidenceUrl } from './feedbackUrls';

export function FeedbackLinksCell({ row, chain }: { row: Feedback; chain: ChainInfo }) {
  const file = evidenceUrl(row.feedbackURI);

  return (
    <td className="links">
      <div className="link-row">
        {row.txHash ? (
          <a
            href={txExplorerUrl(chain, row.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the transaction"
          >
            tx ↗
          </a>
        ) : (
          <span className="muted">—</span>
        )}
        {file ? (
          <a
            href={file}
            target="_blank"
            rel="noopener noreferrer"
            title="Feedback file (feedbackURI)"
          >
            · file ↗
          </a>
        ) : null}
      </div>
      {row.endpoint ? (
        <span className="endpoint ellipsis" title={row.endpoint}>
          {row.endpoint}
        </span>
      ) : null}
    </td>
  );
}
