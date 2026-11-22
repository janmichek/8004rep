import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { NetworkSelect } from '../../../features/filter-network';
import { PageHeading } from '../../../shared/ui';
import { Roster } from '../../../widgets/roster';
import { Summary } from '../../../widgets/summary';

export function AgentsPage() {
  // URL owns which row is expanded, so '/agents/6' opens that detail on load
  const { agentId } = useParams({ from: '/agents/{-$agentId}' });
  const navigate = useNavigate();
  const [network, setNetwork] = useState<string>();
  const expandedId = agentId === undefined ? undefined : Number(agentId);

  function toggle(id: number) {
    void navigate({
      to: '/agents/{-$agentId}',
      params: { agentId: id === expandedId ? undefined : String(id) },
    });
  }

  return (
    <>
      <PageHeading>Agents</PageHeading>
      <NetworkSelect value={network} onChange={setNetwork} />
      <Summary network={network} />
      <Roster network={network} limit={undefined} expandedId={expandedId} onToggle={toggle} />
    </>
  );
}
