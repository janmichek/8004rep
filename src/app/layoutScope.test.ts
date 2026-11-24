import { describe, expect, test, vi } from 'vitest';
import { ALL_NETWORKS, CHAINS, DEFAULT_CHAIN } from '../shared/lib/explorer';
import { activeSlug, navigateForEnvSwitch } from './layoutScope';

type NavigateArg = {
  to:
    | '/agents/$slug'
    | '/network/$slug'
    | '/owners/$slug'
    | '/reviewers/$slug'
    | '/feedbacks/$slug';
  params: { slug: string };
};

describe('activeSlug', () => {
  test('uses all-networks list slug on agents/all', () => {
    const scope = activeSlug('/agents/all', 'mainnet');

    expect(scope.slug).toBe(ALL_NETWORKS);
    expect(scope.listSlug).toBe(ALL_NETWORKS);
    expect(scope.unknown).toBe(false);
  });

  test('marks unknown network slugs', () => {
    const scope = activeSlug('/agents/not-a-chain', 'mainnet');

    expect(scope.unknown).toBe(true);
  });

  test('keeps a matching mainnet chain', () => {
    const main = CHAINS.find((chain) => !chain.testnet) ?? DEFAULT_CHAIN;
    const scope = activeSlug(`/agents/${main.slug}`, 'mainnet');

    expect(scope.active.slug).toBe(main.slug);
    expect(scope.chain?.slug).toBe(main.slug);
  });
});

describe('navigateForEnvSwitch', () => {
  test('a record detail page falls back to the agent list', () => {
    const navigate = vi.fn<(opts: NavigateArg) => void>();
    const main = CHAINS.find((chain) => !chain.testnet) ?? DEFAULT_CHAIN;

    navigateForEnvSwitch({
      pathname: `/owners/${main.slug}/0xabc`,
      slug: main.slug,
      chainTestnet: false,
      value: 'testnet',
      navigate,
    });

    expect(navigate.mock.calls[0]?.[0]).toMatchObject({ to: '/agents/$slug' });
  });

  test('swaps network pages to the matching env chain', () => {
    const navigate = vi.fn<(opts: NavigateArg) => void>();

    const main = CHAINS.find((chain) => !chain.testnet) ?? DEFAULT_CHAIN;

    navigateForEnvSwitch({
      pathname: `/network/${main.slug}`,
      slug: main.slug,
      chainTestnet: false,
      value: 'testnet',
      navigate,
    });

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate.mock.calls[0]?.[0]).toMatchObject({ to: '/network/$slug' });
  });
});
