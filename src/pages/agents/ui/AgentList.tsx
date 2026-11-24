import type { ScanAgent, ScanChain } from '../../../shared/lib/explorer';
import { SortHeader } from '../../../shared/ui';
import { ScanAgentRow } from './ScanAgentRow';

type Props = {
  pinned: ScanAgent[];
  feed: ScanAgent[];
  chains: Map<number, ScanChain>;
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
              text="8004scan's overall score for this agent."
              onSort={() => onSort('score')}
            />
            <SortHeader
              label="Feedback"
              numeric
              active={feedbackSort}
              text="Feedback rows 8004scan has indexed for this agent."
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
            <ScanAgentRow
              key={`pin:${agent.chainId}:${agent.tokenId.toString()}`}
              agent={agent}
              chains={chains}
              pinned
            />
          ))}
          {feed.map((agent) => (
            <ScanAgentRow
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
