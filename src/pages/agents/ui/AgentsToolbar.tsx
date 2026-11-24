import { ChainName, SelectMenu, Skeleton } from '../../../shared/ui';

type Props = {
  envLabel: string;
  network: { id: number; name: string } | undefined;
  total?: number | undefined;
  loading: boolean;
  rated: boolean;
  networkValue: string;
  networks: { id: number; name: string }[];
  onToggleRated: () => void;
  onNetworkChange: (value: string) => void;
};

export function AgentsToolbar({
  envLabel,
  network,
  total,
  loading,
  rated,
  networkValue,
  networks,
  onToggleRated,
  onNetworkChange,
}: Props) {
  const options = [
    { value: 'all', label: 'All networks' },
    ...networks.map((chain) => ({ value: String(chain.id), label: chain.name, chainId: chain.id })),
  ];

  return (
    <div className="agents-toolbar">
      <p className="agents-meta">
        {envLabel} ·{' '}
        {network ? <ChainName chainId={network.id} name={network.name} /> : 'All networks'}
        {loading || total === undefined ? (
          <>
            {' · '}
            <Skeleton width="8em" height="0.75em" />
          </>
        ) : (
          <> · {total.toLocaleString()} registered</>
        )}
      </p>
      <div className="agent-tools">
        <button
          className={`filter-toggle${rated ? ' on' : ''}`}
          type="button"
          aria-pressed={rated}
          onClick={onToggleRated}
        >
          Most rated
        </button>
        <SelectMenu
          compact
          label="Network"
          placeholder="All networks"
          value={networkValue}
          options={options}
          onChange={onNetworkChange}
        />
      </div>
    </div>
  );
}
