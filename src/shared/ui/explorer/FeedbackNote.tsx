import { useEffect, useState } from 'react';
import { resolveFeedbackText } from '../../lib/explorer/data/metadata';

type Loaded = { uri: string; text?: string | undefined; settled: boolean };

export function FeedbackNote({ uri }: { uri: string }) {
  const [state, setState] = useState<Loaded>({ uri, settled: false });

  useEffect(() => {
    let live = true;
    void resolveFeedbackText(uri).then((text) => {
      if (live) setState({ uri, text, settled: true });
    });

    return () => {
      live = false;
    };
  }, [uri]);

  const current = state.uri === uri ? state : undefined;

  if (current?.text) {
    return (
      <span className="ellipsis" title={current.text}>
        “{current.text}”
      </span>
    );
  }

  if (current?.settled) return <span className="muted">—</span>;

  return null;
}
