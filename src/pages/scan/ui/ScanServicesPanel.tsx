import { Fragment } from 'react';
import type { ScanAgentDetail } from '../../../shared/lib/explorer';

type Props = { agent: ScanAgentDetail };

export function ScanServicesPanel({ agent }: Props) {
  return (
    <section className="panel">
      <h3>Services</h3>
      {agent.services.length === 0 ? (
        <p className="muted">No services advertised.</p>
      ) : (
        <dl>
          {agent.services.map((service) => (
            <Fragment key={service.name + service.endpoint}>
              <dt>
                <span className="chip">{service.name}</span>
              </dt>
              <dd>
                <a
                  href={service.endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ellipsis"
                  title={service.endpoint}
                >
                  {service.endpoint}
                </a>
                {service.version ? <small className="muted"> v{service.version}</small> : null}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </section>
  );
}
