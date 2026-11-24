import { addressExplorerUrl, formatDate, shortAddress } from '../../../shared/lib/explorer';
import type { ChainInfo, FeedbackResponse } from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';
import { evidenceUrl } from '../../../shared/ui';

function replyLine(chain: ChainInfo, reply: FeedbackResponse) {
  return (
    <>
      ↩ reply by{' '}
      <a
        href={addressExplorerUrl(chain, reply.responder)}
        target="_blank"
        rel="noopener noreferrer"
        className="address-mark mono"
      >
        <AddressIdenticon address={reply.responder} />
        {shortAddress(reply.responder)}
      </a>
      {reply.createdAt ? ` · ${formatDate(reply.createdAt)}` : ''}
      {reply.uri ? (
        <>
          {' · '}
          {evidenceUrl(reply.uri) ? (
            <a
              href={evidenceUrl(reply.uri)}
              target="_blank"
              rel="noopener noreferrer"
              className="ellipsis"
            >
              {reply.uri}
            </a>
          ) : (
            <span className="muted">inline data</span>
          )}
        </>
      ) : null}
    </>
  );
}

export function FeedbackRepliesList({
  chain,
  replies,
}: {
  chain: ChainInfo;
  replies: FeedbackResponse[];
}) {
  return (
    <>
      <h3>Replies</h3>
      <ul className="responses">
        {replies.map((reply) => (
          <li key={`${reply.responder}-${reply.txHash ?? reply.uri ?? reply.createdAt ?? 'reply'}`}>
            {replyLine(chain, reply)}
          </li>
        ))}
      </ul>
    </>
  );
}
