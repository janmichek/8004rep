import type { ChainInfo } from '../../../lib/explorer';
import { addressExplorerUrl } from '../../../lib/explorer';
import type { FunderCluster } from '../../../lib/explorer/data/funding';
import { shortAddress } from '../../../lib/explorer';
import { AddressIdenticon } from '../../marks/AddressIdenticon';
import { SeverityIcon } from '../SeverityIcon';

type Props = {
  clusters: FunderCluster[];
  chain: ChainInfo;
  fundingChecked: number;
  loading: boolean;
};

export function ReviewersClusters({ clusters, chain, fundingChecked, loading }: Props) {
  if (clusters.length > 0) {
    return (
      <section className="panel">
        <h3>Shared funders</h3>
        <table className="signals">
          <caption className="sr-only">Shared funders, by severity</caption>
          <tbody>
            {clusters.map((cluster) => (
              <tr key={cluster.funder} className={cluster.self ? 'level-high' : 'level-warn'}>
                <td className="signal-level">
                  <SeverityIcon level={cluster.self ? 'high' : 'warn'} />
                </td>
                <td>
                  <a
                    href={addressExplorerUrl(chain, cluster.funder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="address-mark mono"
                  >
                    <AddressIdenticon address={cluster.funder} />
                    {shortAddress(cluster.funder)}
                  </a>
                  {cluster.self ? " — the agent's own address — " : ' first funded '}
                  {cluster.reviewers.length} reviewer{cluster.reviewers.length === 1 ? '' : 's'}:{' '}
                  {cluster.reviewers.map((reviewer) => (
                    <span key={reviewer} className="address-mark mono">
                      <AddressIdenticon address={reviewer} />
                      {shortAddress(reviewer)}
                    </span>
                  ))}
                  .
                  {chain.testnet && !cluster.self ? (
                    <small className="muted">
                      {' '}
                      On testnets a faucet often funds many wallets — open the funder before
                      concluding.
                    </small>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  if (!loading && fundingChecked > 1) {
    return (
      <p className="muted note">No two of the {fundingChecked} traced reviewers share a funder.</p>
    );
  }

  return null;
}
