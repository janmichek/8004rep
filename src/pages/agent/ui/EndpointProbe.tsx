import { useState } from 'react';
import { errorMessage, probeEndpoint, type EndpointProbe as Probe } from '../../../shared/lib/explorer';

type State = { loading: boolean; result?: Probe; error?: string };

function errorWord(error: string): string {
  if (error === 'unreachable') return 'unreachable';
  if (error === 'blocked-url') return 'blocked';
  return 'bad URL';
}

function resultText(result: Probe): string {
  if (result.error) return errorWord(result.error);
  const head = result.status === null ? 'no response' : `HTTP ${result.status}`;
  return result.latencyMs === null ? head : `${head} · ${result.latencyMs} ms`;
}

function resultTone(result: Probe): string {
  if (result.ok) return 'probe-ok';
  if (result.status !== null && result.status < 500) return 'probe-warn';
  return 'probe-bad';
}

function ProbeResult({ state }: { state: State }) {
  if (state.error) return <span className="probe-bad">check failed</span>;
  if (!state.result) return null;

  return (
    <span
      className={resultTone(state.result)}
      title={[state.result.finalUrl, state.result.contentType].filter(Boolean).join(' · ')}
    >
      {resultText(state.result)}
    </span>
  );
}

/** User-triggered liveness check for one advertised service endpoint. */
export function EndpointProbe({ url }: { url: string }) {
  const [state, setState] = useState<State>({ loading: false });

  async function run(): Promise<void> {
    setState({ loading: true });
    try {
      setState({ loading: false, result: await probeEndpoint(url) });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err) });
    }
  }

  return (
    <span className="probe">
      <button type="button" onClick={() => void run()} disabled={state.loading}>
        {state.loading ? 'Checking…' : 'Check'}
      </button>
      <span className="probe-result" aria-live="polite">
        <ProbeResult state={state} />
      </span>
    </span>
  );
}
