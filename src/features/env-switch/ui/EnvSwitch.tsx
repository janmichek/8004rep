import { SelectMenu } from '../../../shared/ui';
import { useNetworkEnv, type NetworkEnv } from '../../../shared/lib/explorer';

const OPTIONS: { value: NetworkEnv; label: string }[] = [
  { value: 'mainnet', label: 'Mainnet' },
  { value: 'testnet', label: 'Testnet' },
];

type Props = { onSwitch: (value: NetworkEnv) => void };

export function EnvSwitch({ onSwitch }: Props) {
  const [env] = useNetworkEnv();

  return (
    <div className="env-switch">
      <SelectMenu
        compact
        label="Network environment"
        value={env}
        options={OPTIONS}
        onChange={(value) => {
          if (value === 'mainnet' || value === 'testnet') onSwitch(value);
        }}
      />
    </div>
  );
}
