import { useEffect, useState } from 'react';
import {
  resolveAgentURI,
  type AgentSummary,
  type RegistrationFile,
} from '../../../shared/lib/explorer';

type Resolved = {
  agent: AgentSummary;
  file: RegistrationFile | null | undefined;
};

/** Registration file behind an agent; undefined while it is being fetched. */
export function useAgentFile(agent: AgentSummary) {
  const [resolved, setResolved] = useState<Resolved>();
  const file = resolved && resolved.agent === agent ? resolved.file : agent.file;

  useEffect(() => {
    let live = true;

    if (agent.file === undefined) {
      void resolveAgentURI(agent.agentURI).then((resolvedFile) => {
        if (live) setResolved({ agent, file: resolvedFile });
      });
    }

    return () => {
      live = false;
    };
  }, [agent]);

  return file;
}
