import type { ReactNode } from 'react';

const EXAMPLES: { title: string; body: ReactNode; note: ReactNode }[] = [
  {
    title: 'Clean',
    body: (
      <>
        8 wallets, 8 units, raw rating average <b>79.8</b>. Filtered score <b>70.8</b>, 80% interval{' '}
        <b>52.0–87.6</b>, <b>medium</b> confidence. One wallet holds 13.9% of the weight; forcing
        the score to 90 would take about <b>20</b> fresh wallets.
      </>
    ),
    note: (
      <>
        The prior and the 90-day half-life pull the number below the raw average. That is the
        conservative part working, not a penalty.
      </>
    ),
  },
  {
    title: 'Thin',
    body: (
      <>
        2 wallets, raw rating average <b>91.0</b>. Filtered score <b>66.0</b>, 80% interval{' '}
        <b>38.3–90.1</b>, <b>low</b> confidence. One wallet holds 51.3% of the weight.
      </>
    ),
    note: (
      <>
        The raw number looks better than the evidence. A wide interval and a low confidence label
        are the honest answer, not a bug.
      </>
    ),
  },
  {
    title: 'Self-inflated',
    body: (
      <>
        8 rows, 2 from the owner. Self rows are listed and weigh <b>0</b>; the 6 independent rows
        give a filtered score of <b>66.0</b> against a raw all-row average of <b>77.0</b>.
      </>
    ),
    note: (
      <>
        Removing the owner’s two perfect scores costs nothing in the row count and changes the
        headline. The Feedback tab keeps the rows visible with the <code>self</code> chip.
      </>
    ),
  },
];

export function DocsExamples() {
  return (
    <section id="examples" className="docs-section">
      <h2>Worked examples</h2>
      <p className="docs-section-intro">
        Three synthetic agents, scored with the same functions the page uses. The point is to see
        where the filtered score separates from the raw average.
      </p>
      <div className="docs-groups">
        {EXAMPLES.map((example) => (
          <article key={example.title} className="panel">
            <h3>{example.title}</h3>
            <p>{example.body}</p>
            <p className="muted">{example.note}</p>
          </article>
        ))}
      </div>
      <p className="docs-note">
        These numbers are illustrative. Open any agent’s Methods tab to see the same waterfall on
        its real rows.
      </p>
    </section>
  );
}
