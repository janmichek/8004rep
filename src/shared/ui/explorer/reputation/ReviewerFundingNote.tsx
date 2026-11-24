import type { ChainInfo } from '../../../lib/explorer';
import { ChainName } from '../ChainName';

export function ReviewerFundingNote({
  chain,
  loading,
  found,
}: {
  chain: ChainInfo;
  loading: boolean;
  found: number;
}) {
  const where = chain.explorerApiUrl ? (
    'and on the block explorer (who first funded them)'
  ) : (
    <>
      (funding cannot be traced on <ChainName chainId={chain.chainId} name={chain.name} />: no
      explorer API that allows browser calls)
    </>
  );

  return (
    <p className="muted note">
      How much each address pulls the score, and what it does elsewhere. The top 12 by weight are
      looked up across agents {where}.
      {loading ? <span className="muted"> Looking up {found}/12…</span> : null}
    </p>
  );
}
