import type { ReactNode } from 'react';

type Props = { title: string; subtitle?: string; head: ReactNode; children: ReactNode };

export function PanelTable({ title, subtitle, head, children }: Props) {
  return (
    <section className="panel">
      <h3>
        {title}
        {subtitle ? <small className="muted">{subtitle}</small> : null}
      </h3>
      <div className="table-wrap">
        <table>
          <thead>{head}</thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
