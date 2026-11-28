function count(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toLocaleString();
}

function syncedAt(value: number | null | undefined): string {
  return value === null || value === undefined
    ? 'not synced yet'
    : `synced ${new Date(value * 1000).toLocaleString()}`;
}

type Values = {
  feedback30d: number | null | undefined;
  totalFeedback: number | null | undefined;
  ratedAgents: number | null | undefined;
  lastIndexedBlock: number | null | undefined;
  syncedAt: number | null | undefined;
  loading: boolean;
};

export function networkTotalTiles(values: Values) {
  const missing = 'not indexed yet';

  return [
    {
      label: '30d activity',
      value: count(values.feedback30d),
      hint: values.feedback30d != null ? 'feedback added in the last 30 days' : missing,
      tone: 'main' as const,
      loading: values.loading,
      title: 'Feedback rows indexed by 8004rep whose block timestamp is in the last 30 days.',
    },
    {
      label: 'Total feedbacks',
      value: count(values.totalFeedback),
      hint: values.totalFeedback != null ? 'indexed on-chain by 8004rep' : missing,
      loading: values.loading,
      title: 'Every ERC-8004 feedback row 8004rep has indexed on this chain.',
    },
    {
      label: 'Rated agents',
      value: count(values.ratedAgents),
      hint: values.ratedAgents != null ? 'with at least one feedback' : missing,
      loading: values.loading,
      title: 'Agents carrying one or more feedback rows in the 8004rep index.',
    },
    {
      label: 'Indexed block',
      value: count(values.lastIndexedBlock),
      hint: syncedAt(values.syncedAt),
      loading: values.loading,
      title: 'The last block the 8004rep indexer has processed for this chain.',
    },
  ];
}
