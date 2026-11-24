import type { ChainInfo } from '../../lib/explorer';
import { formatDate, formatTimeline, txExplorerUrl } from '../../lib/explorer';

type Props = {
  createdAt: number | undefined;
  chain?: ChainInfo | undefined;
  txHash?: string | undefined;
};

export function FeedbackWhenCell({ createdAt, chain, txHash }: Props) {
  if (!createdAt) {
    return (
      <td className="nowrap">
        <span className="muted">—</span>
      </td>
    );
  }

  const label = formatTimeline(createdAt);
  const title = formatDate(createdAt);

  if (!txHash || !chain) {
    return (
      <td className="nowrap">
        <span title={title}>{label}</span>
      </td>
    );
  }

  return (
    <td className="nowrap">
      <a
        href={txExplorerUrl(chain, txHash)}
        target="_blank"
        rel="noopener noreferrer"
        title={title}
      >
        {label}
      </a>
    </td>
  );
}
