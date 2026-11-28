import type { IndexedAgent } from '../../../../shared/lib/explorer';

type Props = {
  agent: IndexedAgent;
  services: string[];
};

export function AgentServicesCell({ agent, services }: Props) {
  if (!services.length && !agent.x402) {
    return (
      <td className="services-td">
        <span className="muted">—</span>
      </td>
    );
  }

  return (
    <td className="services-td">
      <span className="services-cell">
        <span className="services-clip">
          {services.map((service) => (
            <span key={service} className="chip">
              {service}
            </span>
          ))}
          {agent.x402 ? <span className="chip accent">X402</span> : null}
        </span>
        <span className="services-pop" role="tooltip">
          {services.map((service) => (
            <span key={service} className="chip">
              {service}
            </span>
          ))}
          {agent.x402 ? <span className="chip accent">X402</span> : null}
        </span>
      </span>
    </td>
  );
}
