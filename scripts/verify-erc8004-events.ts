import { createPublicClient, http, toEventSelector } from 'viem';
import { base, sepolia } from 'viem/chains';
import { type ChainRecord, CHAIN_CATALOG } from '../shared/chains';
import { identityEventAbi, reputationEventAbi } from '../shared/erc8004Abi';

/**
 * One-off probe: confirms that the topic0 hashes in shared/erc8004Abi.ts are
 * what the live ERC-8004 registries emit, and that the configured start blocks
 * sit below the chain head. Run with `bun run verify:erc8004`.
 */
const rpcUrl = (chainId: number, fallback: string) =>
  process.env[`VERIFY_RPC_URL_${chainId}`]?.trim() || fallback;

// Public nodes keep a wider getLogs budget than the browser defaults.
const CLIENTS = {
  8453: createPublicClient({
    chain: base,
    transport: http(rpcUrl(8453, 'https://base-rpc.publicnode.com')),
  }),
  11155111: createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl(11155111, 'https://ethereum-sepolia-rpc.publicnode.com')),
  }),
} as const;

function clientFor(chainId: 8453 | 11155111) {
  return CLIENTS[chainId];
}

async function probeChain(record: ChainRecord): Promise<void> {
  const client = clientFor(record.chainId === 8453 ? 8453 : 11155111);
  const head = await client.getBlockNumber();
  const fromBlock = head > 9_000n ? head - 9_000n : 0n;

  console.log(`\nchain ${record.chainId} head=${head} startBlock=${record.startBlock}`);

  for (const event of [...identityEventAbi, ...reputationEventAbi]) {
    const topic: string = toEventSelector(event);

    const logs = await client.getLogs({
      address: [record.identity, record.reputation],
      fromBlock,
      toBlock: head,
      event,
    });

    console.log(`  ${event.name.padEnd(18)} topic0=${topic} logs(9k)=${logs.length}`);
  }
}

for (const chainId of [8453, 11155111]) {
  const record = CHAIN_CATALOG.find((chain) => chain.chainId === chainId);

  if (record) await probeChain(record);
}
