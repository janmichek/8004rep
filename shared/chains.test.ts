import { describe, expect, it } from 'vitest';
import { CHAIN_CATALOG, catalogChain, catalogChainsOfEnv } from './chains';
import { identityEventAbi, erc8004EventAbi, reputationEventAbi } from './erc8004Abi';
import { viemChainFor } from './viemChains';

describe('chain catalog', () => {
  it('lists every supported chain once', () => {
    expect(CHAIN_CATALOG).toHaveLength(13);
    expect(new Set(CHAIN_CATALOG.map((chain) => chain.chainId)).size).toBe(13);
    expect(new Set(CHAIN_CATALOG.map((chain) => chain.slug)).size).toBe(13);
  });

  it('uses the chain-family registry addresses', () => {
    const mainnet = CHAIN_CATALOG.filter((chain) => !chain.testnet);
    const testnet = CHAIN_CATALOG.filter((chain) => chain.testnet);
    expect(new Set(mainnet.map((chain) => chain.identity))).toEqual(
      new Set(['0x8004A169FB4a3325136EB29fA0ceB6D2e539a432'])
    );
    expect(new Set(testnet.map((chain) => chain.reputation))).toEqual(
      new Set(['0x8004B663056A597Dffe9eCcC1965A193B7388713'])
    );
  });

  it('looks chains up by id and environment', () => {
    expect(catalogChain(8453)?.slug).toBe('base');
    expect(catalogChain(999_999)).toBeUndefined();
    expect(catalogChainsOfEnv(false).every((chain) => !chain.testnet)).toBe(true);
    expect(catalogChainsOfEnv(true).every((chain) => chain.testnet)).toBe(true);
  });

  it('maps every catalog id onto a viem chain', () => {
    expect(viemChainFor(8453).id).toBe(8453);
    expect(() => viemChainFor(999_999)).toThrow('No viem chain');
  });

  it('keeps the registry ABIs addressable by name', () => {
    expect(identityEventAbi.map((event) => event.name)).toEqual([
      'Transfer',
      'Registered',
      'URIUpdated',
      'MetadataSet',
    ]);
    expect(reputationEventAbi.map((event) => event.name)).toEqual([
      'NewFeedback',
      'FeedbackRevoked',
      'ResponseAppended',
    ]);
    expect(erc8004EventAbi).toHaveLength(7);
  });
});
