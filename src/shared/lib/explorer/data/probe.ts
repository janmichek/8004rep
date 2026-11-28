export type EndpointProbe = {
  ok: boolean;
  status: number | null;
  latencyMs: number | null;
  contentType: string | null;
  finalUrl: string;
  checkedAt: number;
  error?: string;
};

/** Ask the API to GET an advertised endpoint and report its response headers. */
export async function probeEndpoint(url: string): Promise<EndpointProbe> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}api/probe?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!response.ok) throw new Error(`Probe failed with HTTP ${response.status}`);
  return (await response.json()) as EndpointProbe;
}
