import type { RegistrationFile } from '../../../shared/lib/explorer';
import { Skeleton } from '../../../shared/ui';

type Props = {
  file: RegistrationFile | null | undefined;
};

export function AgentServicesCell({ file }: Props) {
  if (file === undefined) {
    return (
      <td>
        <Skeleton width="3.2em" height="1.35em" radius="999px" />
      </td>
    );
  }

  return (
    <td>
      {(file?.services ?? []).map((service) => (
        <span key={service.name + service.endpoint} className="chip">
          {service.name}
        </span>
      ))}
      {file?.x402Support ? <span className="chip accent">x402</span> : null}
    </td>
  );
}
