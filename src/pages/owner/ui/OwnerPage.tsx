import { UnknownNetworkState } from '../../../shared/ui';
import { OwnerClonePanel } from './OwnerClonePanel';
import { OwnerHead } from './OwnerHead';
import { OwnerStatus } from './OwnerStatus';
import { OwnerTiles } from './OwnerTiles';
import { useOwnerAgents } from './useOwnerAgents';
import { useOwnerClones } from './useOwnerClones';

export function OwnerPage() {
  const owner = useOwnerAgents();
  const clones = useOwnerClones(owner.data?.items);

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

      <OwnerClonePanel groups={clones.clones} slug={owner.chain.slug} />

      <OwnerStatus owner={owner} chain={owner.chain} address={owner.address} />
    </>
  );
}
