import { Fragment } from 'react';
import { AgentFacts, AgentStatusBadge, byNetwork, useAgents } from '../../../entities/agent';
import { NetworkMark, useNetworks } from '../../../entities/network';
import { formatScore } from '../../../shared/lib';
import { LoadingState } from '../../../shared/ui';

const headers = ['Network', 'Agent', 'Feedback', 'Score', 'Status'];

type RosterProps = {
  network: string | undefined;
  limit: number | undefined;
  expandedId: number | undefined;
  onToggle: (id: number) => void;
};

export function Roster({ network, limit, expandedId, onToggle }: RosterProps) {
  const { data, isPending, error } = useAgents();
  const { data: networks = [] } = useNetworks();

  if (isPending) return <LoadingState label="Loading..." />;

  if (error) {
    return (
      <p className="notice notice--error" role="alert">
        {error.message}
      </p>
    );
  }

  const newestFirst = byNetwork(data, network).toReversed();
  const rows = limit === undefined ? newestFirst : newestFirst.slice(0, limit);

  if (rows.length === 0) return <p className="notice">No agents match this network.</p>;

  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {rows.map((agent) => {
            const agentNetwork = networks.find((item) => item.code === agent.network);
            const expanded = agent.id === expandedId;

            return (
              <Fragment key={agent.id}>
                <tr>
                  <td>
                    <span className="network-cell">
                      {agentNetwork !== undefined && (
                        <NetworkMark symbol={agentNetwork.symbol} color={agentNetwork.color} />
                      )}
                      {agentNetwork?.name ?? agent.network}
                    </span>
                  </td>
                  <td>{agent.name}</td>
                  <td>{agent.feedbackCount}</td>
                  <td>{agent.score === null ? '—' : formatScore(agent.score)}</td>
                  <td>
                    <AgentStatusBadge status={agent.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button"
                      aria-expanded={expanded}
                      onClick={() => onToggle(agent.id)}
                    >
                      {expanded ? `Hide ${agent.id}` : `Show detail ${agent.id}`}
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={headers.length + 1}>
                      <AgentFacts agent={agent} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
