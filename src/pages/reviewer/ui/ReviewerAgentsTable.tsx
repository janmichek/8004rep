import { useNavigate } from '@tanstack/react-router';
import {
  formatNumber,
  isNestedControl,
  useSort,
  type ReviewerProfile,
  type SortColumn,
} from '../../../shared/lib/explorer';
import { SortHeaderRow } from '../../../shared/ui';

type AgentShare = ReviewerProfile['perAgent'][number];

type Props = { agents: AgentShare[]; slug: string };

const AGENT_COLUMNS: SortColumn<AgentShare>[] = [
  { key: 'agent', value: (agent) => agent.agentName ?? `Agent #${agent.tokenId}` },
  { key: 'reviews', value: (agent) => agent.rows, numeric: true },
  { key: 'average', value: (agent) => agent.ratingAverage, numeric: true },
  { key: 'revoked', value: (agent) => agent.revoked, numeric: true },
];

export function ReviewerAgentsTable({ agents, slug }: Props) {
  const navigate = useNavigate();
  const { sorted, state, toggle } = useSort(agents, AGENT_COLUMNS);

  function open(tokenId: bigint, event?: { target: EventTarget | null }) {
    if (event && isNestedControl(event.target)) return;

    void navigate({
      to: '/agents/$slug/$id',
      params: { slug, id: tokenId.toString() },
    });
  }

  return (
    <section className="panel">
      <h3>Agents it rated</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <SortHeaderRow
              columns={[
                { key: 'agent', label: 'Agent' },
                { key: 'reviews', label: 'Feedback', numeric: true },
                { key: 'average', label: 'Avg rating', numeric: true },
                { key: 'revoked', label: 'Revoked', numeric: true },
              ]}
              state={state}
              toggle={toggle}
            />
          </thead>
          <tbody>
            {sorted.map((agent) => (
              <tr
                key={agent.tokenId.toString()}
                className="row-link"
                role="link"
                tabIndex={0}
                aria-label={`Open ${agent.agentName ?? `Agent #${agent.tokenId}`}`}
                onClick={(event) => open(agent.tokenId, event)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open(agent.tokenId);
                  }
                }}
              >
                <td>
                  {agent.agentName ?? `Agent #${agent.tokenId}`}
                  <small className="muted"> #{agent.tokenId}</small>
                </td>
                <td className="num">{agent.rows}</td>
                <td className="num">
                  {agent.ratingAverage === null ? '—' : formatNumber(agent.ratingAverage)}
                </td>
                <td className="num">{agent.revoked || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
