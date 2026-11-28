import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import {
  addressExplorerUrl,
  formatDate,
  ownerScale,
  registrationCompleteness,
  shortAddress,
  toDisplayUrl,
} from '../../../shared/lib/explorer';
import type { AgentDetail, ChainInfo, RegistrationFile } from '../../../shared/lib/explorer';
import { AddressIdenticon, Disclosure } from '../../../shared/ui';
import { EndpointProbe } from './EndpointProbe';

type Props = {
  agent: AgentDetail;
  chain: ChainInfo;
  file: RegistrationFile | null | undefined;
  rawJson?: string | undefined;
  /** Agents the owner holds on this chain; null when the read failed. */
  ownerAgents?: number | null | undefined;
};

export function AgentIdentityTab({ agent, chain, file, rawJson, ownerAgents }: Props) {
  const uriLink =
    agent.agentURI && !/^data:/i.test(agent.agentURI) ? toDisplayUrl(agent.agentURI) : undefined;

  const scale = ownerScale(ownerAgents);
  const registration = registrationCompleteness(file);

  return (
    <>
      <div className="facts">
        <section className="panel">
          <h3>Identity</h3>
          <dl>
            <dt>Owner</dt>
            <dd>
              {agent.owner ? (
                <Link
                  to="/owners/$slug/$address"
                  params={{ slug: chain.slug, address: agent.owner }}
                  className="address-mark mono"
                  title={agent.owner}
                >
                  <AddressIdenticon address={agent.owner} />
                  {shortAddress(agent.owner)}
                </Link>
              ) : (
                <span className="muted">—</span>
              )}
              {scale && scale.bracket !== 'single' ? (
                <span
                  className={`chip ${scale.level === 'warn' ? 'warn' : ''}`}
                  title={scale.rule}
                >
                  {scale.label} · {scale.agents}
                </span>
              ) : null}
            </dd>
            <dt>Agent wallet</dt>
            <dd>
              {agent.agentWallet ? (
                <a
                  href={addressExplorerUrl(chain, agent.agentWallet)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="address-mark mono"
                  title={agent.agentWallet}
                >
                  <AddressIdenticon address={agent.agentWallet} />
                  {shortAddress(agent.agentWallet)}
                </a>
              ) : (
                <span className="muted">not set</span>
              )}
              {agent.agentWallet && agent.owner && agent.agentWallet.toLowerCase() === agent.owner.toLowerCase() ? (
                <small className="muted"> same as owner</small>
              ) : null}
            </dd>
            <dt>Agent URI</dt>
            <dd>
              {uriLink ? (
                <a href={uriLink} target="_blank" rel="noopener noreferrer" className="mono ellipsis" title={agent.agentURI ?? ''}>
                  {agent.agentURI}
                </a>
              ) : agent.agentURI ? (
                <span className="mono ellipsis" title={agent.agentURI}>
                  {agent.agentURI}
                </span>
              ) : (
                <span className="muted">not set</span>
              )}
            </dd>
            <dt>Registry</dt>
            <dd>
              <a
                href={addressExplorerUrl(chain, chain.identity)}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                title={chain.identity}
              >
                {shortAddress(chain.identity)}
              </a>
            </dd>
            {agent.createdAt ? (
              <>
                <dt>Registered</dt>
                <dd>{formatDate(agent.createdAt)}</dd>
              </>
            ) : null}
          </dl>
        </section>

        <section className="panel">
          <h3>Registration</h3>
          {file === undefined ? (
            <p className="muted">Loading registration file…</p>
          ) : (
            <>
              <p className="muted">
                {registration.passed} of {registration.total} fields usable. This is profile
                quality, not a score input.
              </p>
              <dl>
                {registration.checks.map((check) => (
                  <Fragment key={check.id}>
                    <dt>
                      <span className={`chip ${check.ok ? 'ok' : ''}`}>{check.label}</span>
                    </dt>
                    <dd className={check.ok ? '' : 'muted'}>{check.detail}</dd>
                  </Fragment>
                ))}
              </dl>
            </>
          )}
        </section>

        <section className="panel">
          <h3>Services</h3>
          {!file?.services.length ? (
            <p className="muted">No services advertised.</p>
          ) : (
            <dl>
              {file.services.map((service) => (
                <Fragment key={service.name + service.endpoint}>
                  <dt>
                    <span className="chip">{service.name}</span>
                  </dt>
                  <dd>
                    {toDisplayUrl(service.endpoint) ? (
                      <a
                        href={toDisplayUrl(service.endpoint)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ellipsis"
                        title={service.endpoint}
                      >
                        {service.endpoint}
                      </a>
                    ) : (
                      <span className="ellipsis" title={service.endpoint}>
                        {service.endpoint}
                      </span>
                    )}
                    {service.version ? <small className="muted"> v{service.version}</small> : null}
                    {/^https?:\/\//i.test(service.endpoint) ? (
                      <EndpointProbe url={service.endpoint} />
                    ) : null}
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
        </section>
      </div>

      {rawJson ? (
        <Disclosure label="Raw registration file">
          <pre>{rawJson}</pre>
        </Disclosure>
      ) : null}
    </>
  );
}
