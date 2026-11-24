import type { MouseEvent } from 'react';
import { toggleStar, useIsStarred, type StarKind } from '../lib/explorer';

type Props = {
  kind: StarKind;
  chainId: number;
  id: string | bigint;
  label: string;
  image?: string | undefined;
  variant?: 'icon' | 'label' | undefined;
};

export function StarButton({ kind, chainId, id, label, image, variant = 'label' }: Props) {
  const on = useIsStarred(kind, chainId, id);

  function onToggle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    event.preventDefault();

    if (image) toggleStar({ kind, chainId, id, label, image });
    else toggleStar({ kind, chainId, id, label });
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        className={`star-icon-btn${on ? ' on' : ''}`}
        aria-pressed={on}
        aria-label={on ? `Remove ${label} from starred` : `Star ${label}`}
        title={on ? 'Remove from starred' : 'Star'}
        onClick={onToggle}
      >
        ★
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`filter-toggle star-toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={onToggle}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span> {on ? 'Starred' : 'Star'}
    </button>
  );
}
