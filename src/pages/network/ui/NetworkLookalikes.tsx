import { Link } from '@tanstack/react-router';
import type { ChainInfo } from '../../../shared/lib/explorer';
import { formatPercent, shortAddress } from '../../../shared/lib/explorer';
import type { LookalikeGroup } from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';

export function NetworkLookalikes({
  groups,
  chain,
}: {
  groups: LookalikeGroup[];
  chain: ChainInfo;
}) {
  return (
    <>
      <p className="muted note">
        Agents rated by nearly the same set of reviewers (overlap ≥ 80%, at least 2 shared). One
        crowd reviewing several agents together is how feedback rings and agent farms look — and
        also how a test suite looks.
      </p>
      {groups.length === 0 ? <p className="muted">No lookalike groups in this window.</p> : null}
      <ul className="groups">
        {groups.slice(0, 30).map((group) => (
          <li
            key={group.agents.map((agent) => agent.tokenId.toString()).join('-')}
            className="panel"
          >
            <b>{group.agents.length} agents</b> · {group.reviewers.length} shared reviewers ·
            overlap {formatPercent(group.similarity)}
            <div>
              {group.agents.map((agent) => (
                <Link
                  key={agent.tokenId.toString()}
                  to="/agents/$slug/$id"
                  params={{ slug: chain.slug, id: agent.tokenId.toString() }}
                  className="chip"
                >
                  {agent.agentName ?? `#${agent.tokenId.toString()}`}
                </Link>
              ))}
            </div>
            <small className="muted">
              Reviewers:{' '}
              {group.reviewers.slice(0, 8).map((reviewer) => (
                <Link
                  key={reviewer}
                  to="/reviewers/$slug/$address"
                  params={{ slug: chain.slug, address: reviewer }}
                  className="address-mark mono"
                >
                  <AddressIdenticon address={reviewer} />
                  {shortAddress(reviewer)}
                </Link>
              ))}
              {group.reviewers.length > 8 ? ` +${group.reviewers.length - 8}` : ''}
            </small>
          </li>
        ))}
      </ul>
    </>
  );
}
