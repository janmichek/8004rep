import { useMemo, type ReactNode } from 'react';
import { hashText } from './hash';

type Glyph = 'arbitrum' | 'ethereum' | 'base' | 'mantle' | 'link';

type Mark = {
  color: string;
  glyph: Glyph;
};

type Props = {
  chainId?: number | undefined;
  name?: string | undefined;
  size?: number | undefined;
};

const ETH: Mark = { color: '#627eea', glyph: 'ethereum' };

const KNOWN: Array<{ ids: number[]; needle: string; mark: Mark }> = [
  { ids: [42161, 421614], needle: 'arbitrum', mark: { color: '#28a0f0', glyph: 'arbitrum' } },
  { ids: [1, 11155111], needle: 'ethereum', mark: ETH },
  { ids: [8453, 84532], needle: 'base', mark: { color: '#0052ff', glyph: 'base' } },
  { ids: [5000, 5003], needle: 'mantle', mark: { color: '#0e9f6e', glyph: 'mantle' } },
];

const GLYPHS: Record<Glyph, ReactNode> = {
  arbitrum: <path d="M8 2.6 13.4 13H10.8L8 7.2 5.2 13H2.6Z" fill="#fff" />,
  ethereum: <path d="M8 1.8 12.6 8 8 10.8 3.4 8Zm0 10.2 4.6-2.8L8 14.2 3.4 9.2Z" fill="#fff" />,
  base: <path d="M4.2 6.8h7.6a1.2 1.2 0 0 1 0 2.4H4.2a1.2 1.2 0 0 1 0-2.4Z" fill="#fff" />,
  mantle: <path d="M3.4 12.4V3.6l4.6 5.6 4.6-5.6v8.8h-2.3V7.7L8 10.7 5.7 7.7v4.7Z" fill="#fff" />,
  link: (
    <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
      <path d="M6.2 9.8 9.8 6.2" />
      <path d="M7.4 5.2 8.6 4a2.4 2.4 0 0 1 3.4 3.4l-1.2 1.2" />
      <path d="M8.6 10.8 7.4 12a2.4 2.4 0 0 1-3.4-3.4l1.2-1.2" />
    </g>
  ),
};

function resolveMark(chainId: number | undefined, name: string | undefined): Mark {
  const lower = (name ?? '').toLowerCase();

  for (const entry of KNOWN) {
    const idHit = chainId !== undefined && entry.ids.includes(chainId);
    const nameHit = lower.includes(entry.needle);

    if (idHit || nameHit) return entry.mark;
  }

  if (lower.includes('sepolia')) return ETH;

  const hue = ((chainId ?? hashText(name || 'chain')) * 47) % 360;

  return { color: `hsl(${hue} 65% 52%)`, glyph: 'link' };
}

export function ChainIcon({ chainId, name, size = 16 }: Props) {
  const mark = useMemo(() => resolveMark(chainId, name), [chainId, name]);

  return (
    <span
      className="chain-icon"
      style={{ width: size, height: size, background: mark.color }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16">{GLYPHS[mark.glyph]}</svg>
    </span>
  );
}
