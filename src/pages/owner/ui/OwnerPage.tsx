import { UnknownNetworkState } from '../../../shared/ui';
import { OwnerHead } from './OwnerHead';
import { OwnerStatus } from './OwnerStatus';
import { OwnerTiles } from './OwnerTiles';
import { useOwnerAgents } from './useOwnerAgents';

export function OwnerPage() {
  const owner = useOwnerAgents();

  if (!owner.address) {
    return (
      <section className="state">
        <h1>Not an address</h1>
        <p className="muted">“{owner.rawAddress}” is not a 0x address.</p>
      </section>
    );
  }

  if (!owner.chain) return <UnknownNetworkState />;

  return (
    <>
      <OwnerHead
        address={owner.address}
        chain={owner.chain}
        owned={owner.data?.owned}
        loading={owner.loading}
        dataPresent={Boolean(owner.data)}
      />

      {owner.data && !owner.loading ? (
        <OwnerTiles
          owned={owner.data.owned ?? 0}
          pageCount={owner.data.items.length}
          scores={owner.scores}
          chainName={owner.chain.name}
        />
      ) : null}

      <OwnerStatus owner={owner} chain={owner.chain} address={owner.address} />
    </>
  );
}
