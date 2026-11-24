type Props = {
  loading: boolean;
  empty: boolean;
  loadingLabel: string;
  emptyLabel: string;
};

export function QueryStatus({ loading, empty, loadingLabel, emptyLabel }: Props) {
  if (loading) return <section className="state muted">{loadingLabel}</section>;

  if (empty) return <section className="state muted">{emptyLabel}</section>;

  return null;
}
