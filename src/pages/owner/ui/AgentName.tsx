import type { AgentSummary, RegistrationFile } from '../../../shared/lib/explorer';
import { Skeleton } from '../../../shared/ui';

type Props = {
  agent: AgentSummary;
  file: RegistrationFile | null | undefined;
};

export function AgentName({ agent, file }: Props) {
  const name = file?.name ?? `Agent #${agent.tokenId.toString()}`;

  return (
    <div className="agent-name">
      {file === undefined ? (
        <>
          <Skeleton width="9em" />
          <Skeleton width="14em" height="0.65em" />
        </>
      ) : (
        <>
          <span className="agent-title">{name}</span>
          {file?.description ? <small>{file.description}</small> : null}
          {file === null ? (
            <small className="muted">
              {agent.agentURI ? 'metadata unreachable' : 'no metadata URI'}
            </small>
          ) : null}
        </>
      )}
    </div>
  );
}
