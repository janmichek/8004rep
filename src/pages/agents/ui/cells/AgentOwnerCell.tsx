import { Link } from '@tanstack/react-router';
import { shortAddress, type ChainInfo, type ScanAgent } from '../../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../../shared/ui';

type Props = {
  agent: ScanAgent;
  known: ChainInfo | undefined;
};

export function AgentOwnerCell({ agent, known }: Props) {
  if (!agent.owner) {
    return (
      <td>
        <span className="muted">—</span>
      </td>
    );
  }

  const mark = (
    <>
      <AddressIdenticon address={agent.owner} />
      {shortAddress(agent.owner)}
    </>
  );

  if (!known) {
    return (
      <td>
        <span className="address-mark mono" title={agent.owner}>
          {mark}
        </span>
      </td>
    );
  }

  return (
    <td>
      <Link
        to="/owners/$slug/$address"
        params={{ slug: known.slug, address: agent.owner }}
        className="address-mark mono"
        title={agent.owner}
      >
        {mark}
      </Link>
    </td>
  );
}
