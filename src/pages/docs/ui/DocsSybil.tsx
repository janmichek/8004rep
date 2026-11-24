export function DocsSybil() {
  return (
    <>
      <h3 id="sybil" className="docs-subhead">
        Uncovering sybil feedback
      </h3>
      <p>
        Nothing is hidden: suspected rows stay visible and keep their value. Three signals decide
        how little they count.
      </p>
      <ul className="docs-checks">
        <li>
          <b>One wallet, one vote.</b> Rows from the same wallet, tag and 30-day window collapse
          into one median vote, so extra volume is not extra weight.
        </li>
        <li>
          <b>Row rules.</b> Self-feedback and exact repeats weigh zero; bursts and one-value
          reviewers are discounted, and a neutral prior keeps thin or dominated evidence from
          reading as confident.
        </li>
        <li>
          <b>Wallet links.</b> Reviewers first funded by the same address are grouped on the
          Reviewers tab, and agents rated by nearly the same set of wallets (80% overlap) are
          flagged on Network health.
        </li>
      </ul>
    </>
  );
}
