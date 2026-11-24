export type SortHeaderColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  text?: string;
  static?: boolean;
};

export function latestFeedbackColumns(includeReviewer: boolean): SortHeaderColumn[] {
  const columns: SortHeaderColumn[] = [
    { key: 'agent', label: 'Agent' },
    { key: 'value', label: 'Value', numeric: true },
    { key: 'tags', label: 'Tags', static: true },
    { key: 'text', label: 'Text', static: true },
    { key: 'file', label: 'File', static: true },
    { key: 'when', label: 'When', numeric: true },
  ];

  if (includeReviewer) columns.splice(1, 0, { key: 'reviewer', label: 'Reviewer' });

  return columns;
}
