import {
  AgentAvatar,
  AgentHeadSkeleton,
  AgentQueryError,
  ChainIcon,
  ChainName,
  ReputationPanel,
  Skeleton,
  StarButton,
} from '../../../shared/ui';
import { agentScanUrl, useOwnerAgentCount } from '../../../shared/lib/explorer';
import { AgentIdentityTab } from './AgentIdentityTab';
import { useAgentDetail } from './useAgentDetail';

export function AgentPage() {
  const { chain, id, tokenId, agentQuery, file, tagScales } = useAgentDetail();
  const agent = agentQuery.data;
  const name = file?.name ?? `Agent #${id}`;
  const ownerAgents = useOwnerAgentCount(chain, agent?.owner);

  if (agentQuery.error) {
    return <AgentQueryError error={agentQuery.error} reload={agentQuery.reload} />;
  }

  if (agentQuery.loading || agent === undefined) {
    return <AgentHeadSkeleton tabs />;
  }

  if (!chain) return null;

  if (agent === null) {
    return (
      <section className="state">
        <h1>Agent #{id} not found</h1>
        <p className="muted">
          No such token in the <ChainName chainId={chain.chainId} name={chain.name} /> identity registry.
        </p>
      </section>
    );
  }

  const fileLoading = file === undefined;
  const rawJson = file ? JSON.stringify(file.raw, null, 2) : undefined;

  const overviewTop = fileLoading ? (
    <div className="skeleton-stack description" aria-busy="true">
      <span className="sr-only">Loading registration file</span>
      <Skeleton block width="88%" />
      <Skeleton block width="64%" />
    </div>
  ) : file?.description ? (
    <p className="description">{file.description}</p>
  ) : file === null ? (
    <p className="notice">
      {agent.agentURI
        ? 'The registration file could not be loaded (unreachable host, blocked by CORS, or not JSON). On-chain data is on the Identity tab.'
        : 'This agent has no metadata URI set. On-chain data is on the Identity tab.'}
    </p>
  ) : undefined;

  return (
    <>
      <div className="agent-head">
        <AgentAvatar
          large
          pending={fileLoading}
          image={file?.image}
          label={file?.name ?? ''}
          seed={`${chain.chainId}:${agent.tokenId.toString()}`}
        />
        <div>
          <h1>{fileLoading ? <Skeleton width="12em" height="1.2em" /> : name}</h1>
          <p className="meta">
            <span className="mono">
              <ChainIcon chainId={chain.chainId} name={chain.name} size={13} /> {chain.chainId}:
              {agent.tokenId.toString()}
            </span>
            {fileLoading ? (
              <>
                <Skeleton width="4.2em" height="1.35em" radius="999px" />
                <Skeleton width="3.2em" height="1.35em" radius="999px" />
              </>
            ) : (
              <>
                {file?.active === true ? <span className="chip ok">active</span> : null}
                {file?.active === false ? <span className="chip">inactive</span> : null}
                {file?.x402Support ? <span className="chip accent">x402</span> : null}
                {(file?.supportedTrust ?? []).map((trust) => (
                  <span key={trust} className="chip">
                    {trust}
                  </span>
                ))}
              </>
            )}
            <StarButton
              kind="agent"
              chainId={chain.chainId}
              id={agent.tokenId}
              label={name}
              {...(file?.image ? { image: file.image } : {})}
            />
            <a href={agentScanUrl(chain, agent.tokenId)} target="_blank" rel="noopener noreferrer">
              8004scan ↗
            </a>
          </p>
        </div>
      </div>

      <ReputationPanel
        agent={agent}
        chain={chain}
        file={file}
        ownerAgentCount={ownerAgents.data}
        tagScales={tagScales}
        overviewTop={overviewTop}
        identity={
          <AgentIdentityTab
            agent={agent}
            chain={chain}
            file={file}
            rawJson={rawJson}
            ownerAgents={ownerAgents.data}
          />
        }
      />
    </>
  );
}
