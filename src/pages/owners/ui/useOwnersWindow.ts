import {
  loadAgentWindow,
  ownerDirectory,
  sourceFor,
  useChainLoad,
  useScope,
} from '../../../shared/lib/explorer';
import type { PageFact } from '../../../shared/ui';

export function useOwnersWindow(slug: string) {
  const scope = useScope(slug);

  const { values, loaded, failed, error, loading, load } = useChainLoad(scope, async (chain) => {
    const { source } = await sourceFor(chain);

    return loadAgentWindow(source);
  });

  const agents = Object.values(values).flat();
  const owners = loaded ? ownerDirectory(agents) : undefined;
  const windowSize = agents.length;
  const facts: PageFact[] = [];
  let note: string | undefined;

  if (owners) {
    facts.push({ value: owners.length.toLocaleString(), label: 'owners' });
    facts.push({ value: windowSize.toLocaleString(), label: 'agents scanned' });

    if (scope.all) {
      facts.push({ value: String(scope.chains.length), label: 'networks' });
    }

    const where = scope.all ? 'across these networks' : 'on this network';

    note = `Built from the ${windowSize.toLocaleString()} newest agents ${where}. An owner may hold more agents in the registry than shown here; open the owner page for the full count.`;
  }

  const headers = scope.all
    ? ['Owner', 'Agents', 'Networks', 'Newest agent']
    : ['Owner', 'Agents', 'Newest agent'];

  return { scope, owners, facts, note, headers, failed, error, loading, load };
}
