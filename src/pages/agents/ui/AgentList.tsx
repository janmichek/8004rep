import type { IndexedAgent } from '../../../shared/lib/explorer';
import type { Network } from '@shared/schemas';
import { SortHeader } from '../../../shared/ui';
import { AgentRow } from './AgentRow';

type Props = {
  pinned: IndexedAgent[];
  feed: IndexedAgent[];
  chains: Map<number, Network>;
  registeredSort: 'asc' | 'desc' | null;
  scoreSort: 'asc' | 'desc' | null;
  feedbackSort: 'asc' | 'desc' | null;
  onSort: (next: 'registered' | 'score' | 'feedback') => void;
};

export function AgentList({
  pinned,
  feed,
  chains,
  registeredSort,
  scoreSort,
  feedbackSort,
  onSort,
}: Props) {
  return (
    <div className="table-wrap">
      <table className="agents-table">
        <colgroup>
          <col style={{ width: '27%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Agent</th>
            <th className="num">ID</th>
            <th>Chain</th>
            <th>Services</th>
            <SortHeader
              label="Score"
              numeric
              active={scoreSort}
              text="8004rep rep-1.0 filtered score (ratings only, one vote per wallet, neutral prior)."
              onSort={() => onSort('score')}
            />
            <SortHeader
              label="Feedback"
              numeric
              active={feedbackSort}
              text="On-chain ERC-8004 feedback rows indexed by 8004rep."
              onSort={() => onSort('feedback')}
            />
            <th>Owner</th>
            <SortHeader
              label="Registered"
              numeric
              active={registeredSort}
              onSort={() => onSort('registered')}
            />
          </tr>
        </thead>
        <tbody>
          {pinned.map((agent) => (
            <AgentRow
              key={`pin:${agent.chainId}:${agent.tokenId.toString()}`}
              agent={agent}
              chains={chains}
              pinned
            />
          ))}
          {feed.map((agent) => (
            <AgentRow
              key={`${agent.chainId}:${agent.tokenId.toString()}`}
              agent={agent}
              chains={chains}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
