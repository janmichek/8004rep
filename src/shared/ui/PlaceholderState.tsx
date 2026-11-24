type Props = {
  title: string;
  note?: string | undefined;
};

export function PlaceholderState({ title, note }: Props) {
  return (
    <section className="state">
      <h1>{title}</h1>
      <p className="muted">
        {note ?? 'Porting the classic explorer onto the template — this view is next.'}
      </p>
    </section>
  );
}
