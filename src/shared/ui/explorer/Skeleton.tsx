type Props = {
  width?: string;
  height?: string;
  /** CSS border-radius. Pills and avatars pass their own. */
  radius?: string;
  /** Stretch to the full width of the parent instead of sitting inline. */
  block?: boolean;
};

export function Skeleton({ width = '100%', height = '0.85em', radius, block }: Props) {
  return (
    <span
      className={`skeleton${block ? ' block' : ''}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
