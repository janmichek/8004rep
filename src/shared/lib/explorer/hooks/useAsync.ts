import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../format';

type AsyncState<T> = { data?: T | undefined; error?: string | undefined; loading: boolean };

/**
 * Runs `load` now and whenever `deps` change, exposing its state.
 * A slower earlier run never overwrites a newer one.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const run = ++runRef.current;
    setState({ loading: true });
    loadRef.current().then(
      (data) => {
        if (run === runRef.current) setState({ data, loading: false });
      },
      (err: unknown) => {
        if (run === runRef.current) setState({ error: errorMessage(err), loading: false });
      }
    );
    // oxlint-disable-next-line react/exhaustive-deps -- the caller owns the dependency list
  }, [...deps, nonce]);

  return { ...state, reload };
}
