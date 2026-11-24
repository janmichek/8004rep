import { GLOSSARY_GROUPS } from '../../../shared/lib/explorer';

export function DocsGlossary() {
  return (
    <>
      {GLOSSARY_GROUPS.map((group) => (
        <section key={group.id} id={group.id} className="docs-section docs-glossary">
          <h2>{group.title}</h2>
          <p className="docs-section-intro">{group.intro}</p>
          <dl className="docs-glossary-list">
            {group.entries.map((entry) => (
              <div key={entry.id} id={entry.id} className="docs-glossary-item">
                <dt>
                  <a href={`#${entry.id}`} title={`Link to ${entry.name}`}>
                    {entry.name}
                  </a>
                </dt>
                <dd>
                  {entry.summary}
                  {entry.seeAlso ? (
                    <a className="docs-glossary-see" href={`#${entry.seeAlso}`}>
                      See metric
                    </a>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}
