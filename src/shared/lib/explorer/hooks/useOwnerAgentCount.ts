import type { Address } from 'viem';
import { identityAbi } from '../abi';
import type { ChainInfo } from '../chains';
import { sourceFor } from '../data';
import { useAsync } from './useAsync';

/**
 * Number of agents `owner` holds on `chain`, read from the identity registry.
 * Undefined while loading or when the chain/address is missing; null when the
 * read failed. The agent page uses this for the owner-scale signal.
 */
export function useOwnerAgentCount(
  chain: ChainInfo | undefined,
  owner: Address | null | undefined
) {
  return useAsync(async () => {
    if (!chain || !owner) return null;
    try {
      const { rpcClient } = await sourceFor(chain);
      const balance = await rpcClient.readContract({
        address: chain.identity,
        abi: identityAbi,
        functionName: 'balanceOf',
        args: [owner],
      });
      return Number(balance);
    } catch {
      return null;
    }
  }, [chain?.chainId, owner]);
}
