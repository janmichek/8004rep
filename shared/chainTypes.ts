/** Address literal that survives the shared ↔ server boundary. */
export type EvmAddress = `0x${string}`;

export type ChainColor = 'gray' | 'orange' | 'iris' | 'blue' | 'teal';

export type ChainRecord = {
  chainId: number;
  /** Compact uppercase code for tiles and tables. */
  code: string;
  name: string;
  /** Compact label for the chain picker. */
  shortName: string;
  /** Route segment; same as the network segment of 8004scan agent URLs. */
  slug: string;
  symbol: string;
  color: ChainColor;
  testnet: boolean;
  explorerUrl: string;
  /** 8004scan site listing this network's agents. */
  scanUrl: string;
  identity: EvmAddress;
  reputation: EvmAddress;
  /** Keyless, CORS-enabled RPC. */
  defaultRpcUrl: string;
  /** Higher-limit endpoint for server log scans, when one allows it. */
  defaultLogsRpcUrl?: string;
  /** Max `eth_getLogs` block range of the default RPC. */
  logRange: bigint;
  /** Its max range; defaults to `logRange`. */
  logsLogRange?: bigint;
  /** First block the indexer reads; 0 means "scan from genesis". */
  startBlock: bigint;
  /** Blocks a head must trail before the indexer treats it as final. */
  confirmations: number;
};
