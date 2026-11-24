import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChainInfo } from '../chains';
import { errorMessage } from '../format';
import type { Scope } from './useScope';

export type ChainFailure = { chain: ChainInfo; message: string };

async function loadChains<T>(
  chains: ChainInfo[],
  load: (chain: ChainInfo) => Promise<T>
): Promise<{ values: { chain: ChainInfo; value: T }[]; failed: ChainFailure[] }> {
  const values: { chain: ChainInfo; value: T }[] = [];
  const failed: ChainFailure[] = [];
  for (const chain of chains) {
    try {
      values.push({ chain, value: await load(chain) });
    } catch (err) {
      failed.push({ chain, message: errorMessage(err) });
    }
  }
  return { values, failed };
}

/**
 * Runs `load` for every chain of the scope and keeps the last value per chain,
 * so a page can extend one chain without refetching the others.
 */
export function useChainLoad<T>(
  scope: Scope,
  loadOne: (chain: ChainInfo, previous: T | undefined) => Promise<T>
) {
  const [values, setValues] = useState<Record<number, T>>({});
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<ChainFailure[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const runRef = useRef(0);
  const valuesRef = useRef(values);
  const scopeRef = useRef(scope);
  const loadOneRef = useRef(loadOne);
  valuesRef.current = values;
  scopeRef.current = scope;
  loadOneRef.current = loadOne;

  const load = useCallback(async (extend = false) => {
    const current = ++runRef.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await loadChains(scopeRef.current.chains, (chain) =>
        loadOneRef.current(chain, extend ? valuesRef.current[chain.chainId] : undefined)
      );
      if (current !== runRef.current) return;
      setFailed(result.failed);
      const held = Object.keys(valuesRef.current).length > 0;
      if (!result.values.length && result.failed.length && !(extend && held)) {
        const first = result.failed[0];
        if (first) setError(`${first.chain.name}: ${first.message}`);
        return;
      }
      const next: Record<number, T> = extend ? { ...valuesRef.current } : {};
      for (const { chain, value } of result.values) next[chain.chainId] = value;
      valuesRef.current = next;
      setValues(next);
      setLoaded(true);
    } finally {
      if (current === runRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    valuesRef.current = {};
    setValues({});
    setLoaded(false);
    void load();
    // oxlint-disable-next-line react/exhaustive-deps -- a new scope key restarts the walk
  }, [scope.key]);

  const memo = useMemo(
    () => ({ values, loaded, failed, error, loading, load }),
    [values, loaded, failed, error, loading, load]
  );
  return memo;
}
