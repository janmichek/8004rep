import { useNetworks } from '../../../entities/network';
import { ClearableSelect } from '../../../shared/ui';

type NetworkSelectProps = {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
};

export function NetworkSelect({ value, onChange, disabled = false }: NetworkSelectProps) {
  const { data: networks = [] } = useNetworks();

  return (
    <ClearableSelect
      label="Network"
      placeholder="Select network"
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {networks.map(({ code, name, symbol }) => (
        <option key={code} value={code}>
          {`${symbol} ${name} (${code})`}
        </option>
      ))}
    </ClearableSelect>
  );
}
