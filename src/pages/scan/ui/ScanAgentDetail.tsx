import type { ScanAgentDetail as ScanAgentRecord, ScanChain } from '../../../shared/lib/explorer';
import { ScanAgentHead } from './ScanAgentHead';
import { ScanIdentityPanel } from './ScanIdentityPanel';
import { ScanReputationPanel } from './ScanReputationPanel';
import { ScanServicesPanel } from './ScanServicesPanel';

type Props = {
  agent: ScanAgentRecord;
  id: string;
  network: ScanChain | undefined;
  scanUrl: string;
};

export function ScanAgentDetail({ agent, id, network, scanUrl }: Props) {
  return (
    <>
      <ScanAgentHead agent={agent} id={id} scanUrl={scanUrl} />

      {agent.description ? <p className="description">{agent.description}</p> : null}

      <p className="notice">
        {network?.name ?? `Chain ${agent.chainId}`} is not configured for on-chain reads in 8004rep
        yet, so this record comes from 8004scan&apos;s index.
      </p>

      <div className="facts">
        <ScanIdentityPanel agent={agent} />
        <ScanServicesPanel agent={agent} />
      </div>

      <ScanReputationPanel agent={agent} />
    </>
  );
}
