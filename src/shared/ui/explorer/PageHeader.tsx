import type { ComponentType, ReactNode } from 'react';
import { PageHeaderFacts } from './PageHeaderFacts';
import { PageHeaderTitle, type PageFact } from './PageHeaderTitle';

type Props = {
  title: string;
  description?: string;
  /** Page mark, drawn in a tinted tile next to the title. */
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  facts?: PageFact[];
  note?: string | undefined;
  loading?: boolean;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  icon,
  facts = [],
  note,
  loading = false,
  actions,
}: Props) {
  const showFoot = loading || facts.length > 0 || Boolean(note);

  return (
    <header className="page-header">
      <PageHeaderTitle title={title} description={description} icon={icon} actions={actions} />
      {showFoot ? <PageHeaderFacts facts={facts} note={note} loading={loading} /> : null}
    </header>
  );
}
