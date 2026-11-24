import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { NetworkSelect } from '../../../features/filter-network';
import { PageHeading } from '../../../shared/ui';
import { Roster } from '../../../widgets/roster';
import { Summary } from '../../../widgets/summary';

// The page owns the network filter because two widgets read it.
export function OverviewPage() {
  const [network, setNetwork] = useState<string>();
  const navigate = useNavigate();

  function openAgent(id: number) {
    void navigate({ to: '/agents/{-$agentId}', params: { agentId: String(id) } });
  }

  return (
    <>
      <PageHeading>Overview</PageHeading>
      <NetworkSelect value={network} onChange={setNetwork} />
      <Summary network={network} />
      <Roster network={network} limit={3} expandedId={undefined} onToggle={openAgent} />
    </>
  );
}
