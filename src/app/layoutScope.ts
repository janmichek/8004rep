import { ALL_NETWORKS, CHAINS, DEFAULT_CHAIN, findChainBySlug } from '../shared/lib/explorer';
import type { NetworkEnv } from '../shared/lib/explorer';

export function activeSlug(pathname: string, env: NetworkEnv) {
  const match = pathname.match(/^\/(?:agents|owners|reviewers|feedbacks|network)\/([^/]+)/);
  const slug = match?.[1];
  const chain = slug && slug !== ALL_NETWORKS ? findChainBySlug(slug) : undefined;
  const fallback = CHAINS.find((item) => item.testnet === (env === 'testnet')) ?? DEFAULT_CHAIN;
  const active = chain && chain.testnet === (env === 'testnet') ? chain : fallback;

  return {
    slug,
    chain,
    active,
    listSlug: slug === ALL_NETWORKS ? ALL_NETWORKS : active.slug,
    unknown: Boolean(slug && !chain && slug !== ALL_NETWORKS),
  };
}

type EnvRoute =
  | '/network/$slug'
  | '/owners/$slug'
  | '/reviewers/$slug'
  | '/feedbacks/$slug'
  | '/agents/$slug';

function envDestination(base: string, listPage: boolean): EnvRoute {
  if (base === 'network') return '/network/$slug';

  if (!listPage) return '/agents/$slug';

  if (base === 'owners') return '/owners/$slug';

  if (base === 'reviewers') return '/reviewers/$slug';

  if (base === 'feedbacks') return '/feedbacks/$slug';

  return '/agents/$slug';
}

export function navigateForEnvSwitch(args: {
  pathname: string;
  slug: string | undefined;
  chainTestnet: boolean | undefined;
  value: NetworkEnv;
  navigate: (opts: {
    to:
      | '/agents/$slug'
      | '/network/$slug'
      | '/owners/$slug'
      | '/reviewers/$slug'
      | '/feedbacks/$slug';
    params: { slug: string };
  }) => void;
}) {
  const { pathname, slug, chainTestnet, value, navigate } = args;

  if (!slug || slug === ALL_NETWORKS) return;

  const testnet = value === 'testnet';

  if (chainTestnet === testnet) return;

  const target = CHAINS.find((item) => item.testnet === testnet) ?? DEFAULT_CHAIN;
  const base = pathname.split('/')[1] ?? '';
  const listPage = pathname.split('/').filter(Boolean).length === 2;

  navigate({ to: envDestination(base, listPage), params: { slug: target.slug } });
}
