export function AgentQueryError({ error, reload }: { error: string; reload: () => void }) {
  return (
    <section className="state">
      <p>Could not load agent: {error}</p>
      <button type="button" onClick={reload}>
        Retry
      </button>
    </section>
  );
}
