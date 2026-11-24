import type { ResolvedSource } from '../../lib/explorer/data';
import { formatDuration } from '../../lib/explorer';
import { Hint } from './Hint';
import { Skeleton } from './Skeleton';

type Props = { resolved?: ResolvedSource | undefined };

/** Below this the subgraph counts as live. */
const LAG_SHOWN_SECONDS = 600;

export function SourceBadge({ resolved }: Props) {
  if (!resolved) return <Skeleton width="7.5em" height="22px" radius="999px" />;

  const seconds = resolved.lagSeconds;

  const lag =
    seconds !== undefined && seconds > LAG_SHOWN_SECONDS ? formatDuration(seconds) : undefined;

  if (resolved.source.kind === 'subgraph') {
    return (
      <Hint text="Agents are read from the chain's subgraph">
        <span className="badge ok" tabIndex={0}>
          subgraph
          {lag ? ` · ${lag} behind` : ''}
        </span>
      </Hint>
    );
  }

  return (
    <Hint text={resolved.note ?? 'Agents are read directly from the registry contracts'}>
      <span className={`badge${resolved.note ? ' warn' : ''}`} tabIndex={0}>
        rpc
        {resolved.note ? ' · no subgraph' : ''}
      </span>
    </Hint>
  );
}
