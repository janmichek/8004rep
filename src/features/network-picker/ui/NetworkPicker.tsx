import { useNavigate } from '@tanstack/react-router';
import {
  ALL_NETWORKS,
  chainsForEnv,
  useNetworkEnv,
  type NetworkEnv,
} from '../../../shared/lib/explorer';
import { SelectMenu, type SelectOption } from '../../../shared/ui';

type RouteName = 'owners' | 'reviewers' | 'feedbacks' | 'network';

type Props = { routeName: RouteName; slug: string; allowAll?: boolean | undefined };

function routeFor(name: RouteName, slug: string) {
  if (name === 'network') return { to: '/network/$slug' as const, params: { slug } };

  if (name === 'owners') return { to: '/owners/$slug' as const, params: { slug } };

  if (name === 'reviewers') return { to: '/reviewers/$slug' as const, params: { slug } };

  return { to: '/feedbacks/$slug' as const, params: { slug } };
}

function optionsFor(env: NetworkEnv, allowAll: boolean): SelectOption[] {
  const chains = chainsForEnv(env).map((chain) => ({
    value: chain.slug,
    label: chain.name,
    chainId: chain.chainId,
  }));

  return allowAll ? [{ value: ALL_NETWORKS, label: 'All networks' }, ...chains] : chains;
}

export function NetworkPicker({ routeName, slug, allowAll = true }: Props) {
  const [env] = useNetworkEnv();
  const navigate = useNavigate();
  const options = optionsFor(env, allowAll);

  function select(value: string) {
    if (!value || value === slug) return;
    void navigate(routeFor(routeName, value));
  }

  return <SelectMenu compact label="Network" value={slug} options={options} onChange={select} />;
}
