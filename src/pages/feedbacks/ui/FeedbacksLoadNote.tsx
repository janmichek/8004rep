export function FeedbacksLoadNote({
  hasMore,
  loading,
  load,
}: {
  hasMore: boolean;
  loading: boolean;
  load: (extend?: boolean) => Promise<void>;
}) {
  if (!hasMore) return <p className="muted note">That is everything the source holds.</p>;

  return (
    <p className="muted note">
      <button type="button" disabled={loading} onClick={() => void load(true)}>
        {loading ? 'Loading…' : 'Load older feedback'}
      </button>
    </p>
  );
}
