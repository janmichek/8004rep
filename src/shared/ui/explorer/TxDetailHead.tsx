import { addressExplorerUrl, shortAddress, txExplorerUrl } from '../../lib/explorer';
import type { ChainInfo } from '../../lib/explorer';
import type { TxDetailFacts } from '../../lib/explorer/data/txChecks';
import { AddressIdenticon } from '../marks/AddressIdenticon';

type Props = { chain: ChainInfo; facts: TxDetailFacts | undefined; hasView: boolean };

function txMeta(chain: ChainInfo, facts: TxDetailFacts) {
  const tx = facts.tx;

  if (!tx) return null;

  return (
    <span className="tx-detail-meta">
      <a
        href={txExplorerUrl(chain, tx.hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="mono"
      >
        {shortAddress(tx.hash)} ↗
      </a>{' '}
      · block {tx.blockNumber.toString()} · sent by{' '}
      <a
        href={addressExplorerUrl(chain, tx.from)}
        target="_blank"
        rel="noopener noreferrer"
        className="address-mark mono"
      >
        <AddressIdenticon address={tx.from} />
        {shortAddress(tx.from)}
      </a>
    </span>
  );
}

export function TxDetailHead({ chain, facts, hasView }: Props) {
  return (
    <div className="tx-detail-head">
      <h2>Tx detail</h2>
      {facts ? txMeta(chain, facts) : null}
      {hasView ? (
        <span className="tx-detail-meta tx-detail-hint">hover a line for its rule</span>
      ) : null}
    </div>
  );
}
