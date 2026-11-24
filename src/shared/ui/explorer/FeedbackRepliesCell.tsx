import { shortAddress } from '../../lib/explorer';
import type { ListRow } from './feedbackListTypes';

export function FeedbackRepliesCell({ entry }: { entry: ListRow }) {
  const responses = entry.row.responses;

  return (
    <td>
      {responses?.length ? (
        <span
          className="chip accent"
          title={responses
            .map((reply) => `${shortAddress(reply.responder)}${reply.uri ? ` → ${reply.uri}` : ''}`)
            .join('\n')}
        >
          ↩ {responses.length}
        </span>
      ) : null}
    </td>
  );
}
