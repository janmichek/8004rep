/**
 * Stars for agents, owners and reviewers — localStorage only, no backend.
 */
export type StarKind = 'agent' | 'owner' | 'reviewer';

export type Star = {
  kind: StarKind;
  chainId: number;
  id: string;
  label: string;
  image?: string;
};

const KINDS: readonly StarKind[] = ['agent', 'owner', 'reviewer'];
const KEY = '8004rep:stars';
const LEGACY_KEY = '8004rep:bookmarks';

type Listener = () => void;
const listeners = new Set<Listener>();

function normalizeId(kind: StarKind, id: string | bigint): string {
  const value = id.toString();
  return kind === 'agent' ? value : value.toLowerCase();
}

export function starKey(kind: StarKind, chainId: number, id: string | bigint): string {
  return `${kind}:${chainId}:${normalizeId(kind, id)}`;
}

function valid(value: unknown): value is Star {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<Star>;
  return (
    KINDS.includes(row.kind as StarKind) &&
    Number.isInteger(row.chainId) &&
    typeof row.id === 'string' &&
    row.id !== '' &&
    typeof row.label === 'string' &&
    (row.image === undefined || typeof row.image === 'string')
  );
}

function loadStored(): Star[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(valid) : [];
  } catch {
    return [];
  }
}

function loadLegacy(): Star[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return [];
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    return [];
  }
  try {
    const data = JSON.parse(raw) as { mainnet?: unknown; testnet?: unknown };
    const rows = [
      ...(Array.isArray(data.mainnet) ? data.mainnet : []),
      ...(Array.isArray(data.testnet) ? data.testnet : []),
    ];
    return rows.flatMap((row): Star[] => {
      const { chainId, tokenId } = (row ?? {}) as { chainId?: unknown; tokenId?: unknown };
      if (!Number.isInteger(chainId) || typeof tokenId !== 'string' || !/^\d+$/.test(tokenId))
        return [];
      return [{ kind: 'agent', chainId: chainId as number, id: tokenId, label: '' }];
    });
  } catch {
    return [];
  }
}

function save(next: Star[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode
  }
}

function load(): Star[] {
  const stored = loadStored();
  const legacy = loadLegacy();
  if (legacy.length === 0) return stored;
  const seen = new Set(stored.map((row) => starKey(row.kind, row.chainId, row.id)));
  const merged = [
    ...stored,
    ...legacy.filter((row) => !seen.has(starKey(row.kind, row.chainId, row.id))),
  ];
  save(merged);
  return merged;
}

let store: Star[] = typeof window === 'undefined' ? [] : load();

function emit(): void {
  listeners.forEach((l) => l());
}

export function getStarred(): Star[] {
  return store;
}

export function getStarCount(): number {
  return store.length;
}

export function subscribeStars(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStarred(kind: StarKind, chainId: number, id: string | bigint): boolean {
  const key = starKey(kind, chainId, id);
  return store.some((row) => starKey(row.kind, row.chainId, row.id) === key);
}

export function toggleStar(entry: {
  kind: StarKind;
  chainId: number;
  id: string | bigint;
  label: string;
  image?: string;
}): void {
  const key = starKey(entry.kind, entry.chainId, entry.id);
  const next = store.some((row) => starKey(row.kind, row.chainId, row.id) === key)
    ? store.filter((row) => starKey(row.kind, row.chainId, row.id) !== key)
    : [
        {
          kind: entry.kind,
          chainId: entry.chainId,
          id: normalizeId(entry.kind, entry.id),
          label: entry.label,
          ...(entry.image ? { image: entry.image } : {}),
        },
        ...store,
      ];
  store = next;
  save(next);
  emit();
}
