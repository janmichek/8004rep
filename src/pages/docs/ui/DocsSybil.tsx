const SIGNALS = [
  {
    title: 'One wallet, one vote.',
    body: 'Rows from the same wallet, tag and 30-day window collapse into one median vote, so extra volume is not extra weight.',
  },
  {
    title: 'Row rules.',
    body: 'Self-feedback and exact repeats weigh zero; bursts and one-value reviewers are discounted, and a neutral prior keeps thin or dominated evidence from reading as confident.',
  },
  {
    title: 'Wallet links.',
    body: 'Reviewers first funded by the same address are grouped on the Reviewers tab, and agents rated by nearly the same set of wallets (80% overlap) are flagged on Network health.',
  },
  {
    title: 'Registration clusters.',
    body: 'The owner page counts an owner’s agents and compares their registration text; 80% shared wording links them as a clone group. The owner count is context, not a cap on the score.',
  },
];

export function DocsSybil() {
  return (
    <>
      <h3 id="sybil" className="docs-subhead">
        Uncovering sybil feedback
      </h3>
      <p>
        Nothing is hidden: suspected rows stay visible and keep their value. These signals decide
        what counts.
      </p>
      <ul className="docs-checks">
        {SIGNALS.map((signal) => (
          <li key={signal.title}>
            <b>{signal.title}</b> {signal.body}
          </li>
        ))}
      </ul>
    </>
  );
}
