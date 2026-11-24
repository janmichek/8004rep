import type { Address, Hex } from 'viem';
import { errorMessage, sourceFor, useAsync, type ChainInfo } from '../../../shared/lib/explorer';
import { fetchFunding, type Funding } from '../../../shared/lib/explorer';

export type ReviewerWallet = {
  nonce: number | undefined;
  kind: string | undefined;
  funding: Funding | null | undefined;
  fundingError: string | undefined;
};

function walletKind(bytecode: Hex | undefined): string | undefined {
  if (bytecode === undefined) return undefined;

  if (bytecode === '0x') return 'wallet';

  if (bytecode.toLowerCase().startsWith('0xef0100')) return 'wallet + 7702';

  return 'contract';
}

/** Wallet facts load once per chain and address; the feed grows separately. */
export function useReviewerWallet(chain: ChainInfo | undefined, address: Address | undefined) {
  return useAsync(async (): Promise<ReviewerWallet | null> => {
    if (!chain || !address) return null;

    const { rpcClient } = await sourceFor(chain);
    const { explorerApiUrl } = chain;

    const [nonce, code, funding] = await Promise.allSettled([
      rpcClient.getTransactionCount({ address }),
      rpcClient.getCode({ address }),
      explorerApiUrl
        ? fetchFunding({ ...chain, explorerApiUrl }, address)
        : Promise.resolve(undefined),
    ]);

    const bytecode = code.status === 'fulfilled' ? (code.value ?? '0x') : undefined;

    return {
      nonce: nonce.status === 'fulfilled' ? nonce.value : undefined,
      kind: walletKind(bytecode),
      funding: funding.status === 'fulfilled' ? funding.value : undefined,
      fundingError: funding.status === 'rejected' ? errorMessage(funding.reason) : undefined,
    };
  }, [chain, address]);
}
