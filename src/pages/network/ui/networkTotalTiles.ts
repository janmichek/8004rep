function count(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

type Values = {
  feedback30d: number | null | undefined;
  totalFeedback: number | null | undefined;
  ratedAgents: number | null | undefined;
  loading: boolean;
};

export function networkTotalTiles(values: Values) {
  const missing = 'not reported by 8004scan';

  return [
    {
      label: '30d activity',
      value: count(values.feedback30d),
      hint: values.feedback30d != null ? 'feedback added in the last 30 days' : missing,
      tone: 'main' as const,
      loading: values.loading,
      title: "The latest day of 8004scan's 30-day feedback series minus its first day.",
    },
    {
      label: 'Total feedbacks',
      value: count(values.totalFeedback),
      hint: values.totalFeedback != null ? 'indexed by 8004scan' : missing,
      loading: values.loading,
      title:
        'Every feedback row 8004scan has indexed on this chain; the window below is a bounded sample.',
    },
    {
      label: 'Rated agents',
      value: count(values.ratedAgents),
      hint: values.ratedAgents != null ? 'with at least one feedback' : missing,
      loading: values.loading,
      title: "Agents carrying one or more feedback rows in 8004scan's index.",
    },
  ];
}
