type Props = {
  error: string;
  onRetry: () => void;
};

export function AgentsError({ error, onRetry }: Props) {
  return (
    <section className="state">
      <p>Could not load agents: {error}</p>
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </section>
  );
}
