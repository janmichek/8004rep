import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { ChainName } from '../shared/ui';
import { CHAINS } from '../shared/lib/explorer';
import {
  sourceFor,
  useAsync,
  useNetworkEnv,
  useScrollToHash,
  useStarCount,
} from '../shared/lib/explorer';
import type { NetworkEnv } from '../shared/lib/explorer';
import { activeSlug, navigateForEnvSwitch } from './layoutScope';
import { Topbar } from './Topbar';

export function Layout() {
  const [env, setEnv] = useNetworkEnv();
  const starCount = useStarCount();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const scope = activeSlug(pathname, env);
  useScrollToHash();

  const isAgentsList = /^\/agents\/[^/]+$/.test(pathname);

  const source = useAsync(
    () => (scope.chain ? sourceFor(scope.chain) : Promise.resolve(undefined)),
    [scope.chain?.chainId]
  );

  function onSwitch(value: NetworkEnv) {
    setEnv(value);
    navigateForEnvSwitch({
      pathname,
      slug: scope.slug,
      chainTestnet: scope.chain?.testnet,
      value,
      navigate: (opts) => {
        void navigate(opts);
      },
    });
  }

  return (
    <>
      <Topbar
        activeSlug={scope.active.slug}
        listSlug={scope.listSlug}
        starCount={starCount}
        resolved={source.data}
        showSource={Boolean(scope.chain) && !isAgentsList}
        onSwitch={onSwitch}
      />
      <main>
        {scope.unknown ? (
          <section className="state">
            <h1>Unknown network “{scope.slug}”</h1>
            <p>Supported networks:</p>
            <ul className="plain">
              {CHAINS.map((chain) => (
                <li key={chain.chainId}>
                  <Link to="/agents/$slug" params={{ slug: chain.slug }}>
                    <ChainName chainId={chain.chainId} name={chain.name} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <div className="page">
            <Outlet />
          </div>
        )}
      </main>
      <footer>
        Read-only: no wallet, no backend. Data comes straight from the ERC-8004 registries and
        public subgraphs. <Link to="/docs">How the numbers work</Link>
      </footer>
    </>
  );
}
