import { formatDate, shortAddress, type ScanAgentDetail } from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';

type Props = { agent: ScanAgentDetail };

export function ScanIdentityPanel({ agent }: Props) {
  return (
    <section className="panel">
      <h3>Identity</h3>
      <dl>
        <dt>Owner</dt>
        <dd>
          {agent.owner ? (
            <span className="address-mark mono" title={agent.owner}>
              <AddressIdenticon address={agent.owner} /> {shortAddress(agent.owner)}
            </span>
          ) : (
            <span className="muted">—</span>
          )}
        </dd>
        <dt>Agent wallet</dt>
        <dd>
          {agent.agentWallet ? (
            <span className="address-mark mono" title={agent.agentWallet}>
              <AddressIdenticon address={agent.agentWallet} /> {shortAddress(agent.agentWallet)}
            </span>
          ) : (
            <span className="muted">not set</span>
          )}
        </dd>
        {agent.createdAt ? (
          <>
            <dt>Registered</dt>
            <dd>{formatDate(agent.createdAt)}</dd>
          </>
        ) : null}
        {agent.supportedTrust.length ? (
          <>
            <dt>Trust models</dt>
            <dd>
              {agent.supportedTrust.map((trust) => (
                <span key={trust} className="chip">
                  {trust}
                </span>
              ))}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
