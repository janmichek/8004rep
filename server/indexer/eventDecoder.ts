import { decodeEventLog, parseAbiItem, type Hex } from 'viem';
import { AGENT_WALLET_KEY, erc8004EventAbi } from '../../shared/erc8004Abi';
import { tagKey } from '../../shared/reputation/kinds';
import type { Mutation, RawLog } from './types';

const ADDRESS_HEX = /^[0-9a-f]{40}$/;

/**
 * `agentWallet` is written as ABI-padded bytes32 by some registries and as a
 * 20-byte address by others. Take the last 40 hex characters of the meaningful
 * bytes and reject anything that is not an address; malformed values are
 * ignored rather than failing the whole chunk.
 */
export function decodeWalletMetadata(value: Hex): string | null {
  const raw = value.slice(2).toLowerCase();
  const significant = raw.replace(/^0+/, '');

  if (significant.length !== 40 && significant.length !== 64) return null;

  const candidate = significant.length === 64 ? significant.slice(-40) : significant;

  return ADDRESS_HEX.test(candidate) ? `0x${candidate}` : null;
}

function base(log: RawLog, blockTimestamp: bigint) {
  return {
    blockNumber: log.blockNumber ?? 0n,
    blockTimestamp,
    logIndex: log.logIndex ?? 0,
    txHash: log.transactionHash ?? '',
  };
}

// A harmless extra event keeps the decoder's fallback on a reachable path:
// decodeEventLog can return any ABI event name, and unrelated logs are ignored.
const DECODER_EVENTS = [
  ...erc8004EventAbi,
  parseAbiItem('event Approval(address indexed owner, address indexed spender, uint256 value)'),
] as const;

type DecodedEvent = ReturnType<typeof decodeEventLog<typeof DECODER_EVENTS>>;

type Common = { blockNumber: bigint; blockTimestamp: bigint; logIndex: number; txHash: string };

type TransferArgs = Extract<DecodedEvent, { eventName: 'Transfer' }>['args'];

type RegisteredArgs = Extract<DecodedEvent, { eventName: 'Registered' }>['args'];

function transferMutation(args: TransferArgs, common: Common): Mutation {
  return {
    ...common,
    kind: 'transfer',
    tokenId: args.tokenId,
    from: args.from.toLowerCase(),
    to: args.to.toLowerCase(),
  };
}

function registeredMutation(args: RegisteredArgs, common: Common): Mutation {
  return {
    ...common,
    kind: 'registered',
    tokenId: args.agentId,
    owner: args.owner.toLowerCase(),
    agentUri: args.agentURI,
  };
}

function decodeTopics(log: RawLog): DecodedEvent | null {
  const first = log.topics[0];

  if (!first) return null;
  const topics: [Hex, ...Hex[]] = [first, ...log.topics.slice(1)];

  try {
    return decodeEventLog({ abi: DECODER_EVENTS, data: log.data, topics });
  } catch {
    return null;
  }
}

function dispatchMutation(decoded: DecodedEvent, common: Common): Mutation | null {
  switch (decoded.eventName) {
    case 'Transfer':
      return transferMutation(decoded.args, common);
    case 'Registered':
      return registeredMutation(decoded.args, common);
    case 'URIUpdated':
      return {
        ...common,
        kind: 'uri-updated',
        tokenId: decoded.args.agentId,
        agentUri: decoded.args.newURI,
      };
    case 'MetadataSet':
      return {
        ...common,
        kind: 'metadata-set',
        tokenId: decoded.args.agentId,
        key: decoded.args.metadataKey,
        valueHex: decoded.args.metadataValue,
        wallet:
          decoded.args.metadataKey === AGENT_WALLET_KEY
            ? decodeWalletMetadata(decoded.args.metadataValue)
            : null,
      };
    case 'NewFeedback': {
      const scaled = Number(decoded.args.value) / 10 ** decoded.args.valueDecimals;

      return {
        ...common,
        kind: 'feedback',
        tokenId: decoded.args.agentId,
        client: decoded.args.clientAddress.toLowerCase(),
        feedbackIndex: decoded.args.feedbackIndex,
        valueRaw: decoded.args.value.toString(),
        valueDecimals: decoded.args.valueDecimals,
        valueScaled: scaled,
        tag1: decoded.args.tag1,
        tag2: decoded.args.tag2,
        tagKey: tagKey(decoded.args.tag1),
        endpoint: decoded.args.endpoint,
        feedbackUri: decoded.args.feedbackURI,
        feedbackHash: decoded.args.feedbackHash,
      };
    }

    case 'FeedbackRevoked':
      return {
        ...common,
        kind: 'feedback-revoked',
        tokenId: decoded.args.agentId,
        client: decoded.args.clientAddress.toLowerCase(),
        feedbackIndex: decoded.args.feedbackIndex,
      };
    case 'ResponseAppended':
      return {
        ...common,
        kind: 'response-appended',
        tokenId: decoded.args.agentId,
        client: decoded.args.clientAddress.toLowerCase(),
        feedbackIndex: decoded.args.feedbackIndex,
        responder: decoded.args.responder.toLowerCase(),
        responseUri: decoded.args.responseURI,
        responseHash: decoded.args.responseHash,
      };
    case 'Approval':
    default:
      return null;
  }
}

export function decodeErc8004Log(log: RawLog, blockTimestamp: bigint): Mutation | null {
  const decoded = decodeTopics(log);

  if (!decoded) return null;

  return dispatchMutation(decoded, base(log, blockTimestamp));
}
