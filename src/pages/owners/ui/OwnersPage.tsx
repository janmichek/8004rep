import { useParams } from '@tanstack/react-router';
import { Wallet } from 'lucide-react';
import { PageHeader } from '../../../shared/ui';
import { NetworkPicker } from '../../../features/network-picker';
import { OwnersResults } from './OwnersResults';
import { useOwnersWindow } from './useOwnersWindow';

export function OwnersPage() {
  const { slug } = useParams({ from: '/owners/$slug' });
  const window = useOwnersWindow(slug);

  return (
    <>
      <PageHeader
        title="Owners"
        description="Who holds the newest registered agents, one row per address."
        icon={Wallet}
        facts={window.facts}
        note={window.note}
        loading={window.loading && !window.owners}
        actions={<NetworkPicker routeName="owners" slug={slug} />}
      />

      {window.failed.length > 0 && window.owners ? (
        <p className="notice">
          Could not load agents on {window.failed.map((failure) => failure.chain.name).join(', ')};
          those networks are left out.
        </p>
      ) : null}

      <OwnersResults
        owners={window.owners}
        loading={window.loading}
        error={window.error}
        headers={window.headers}
        slug={slug}
        showNetworks={window.scope.all}
        onRetry={() => {
          void window.load();
        }}
      />
    </>
  );
}
