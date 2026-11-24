import {
  LABEL_INFO,
  formatNumber,
  networkNames,
  shortAddress,
  type ReviewerProfile,
} from '../../../shared/lib/explorer';
import { AddressIdenticon, Hint, ReviewerChip } from '../../../shared/ui';

type Props = {
  reviewer: ReviewerProfile;
  all: boolean;
  onOpen: (reviewer: ReviewerProfile, event?: { target: EventTarget | null }) => void;
};

export function ReviewerRow({ reviewer, all, onOpen }: Props) {
  return (
    <tr
      className="row-link"
      role="link"
      tabIndex={0}
      aria-label={`Open reviewer ${shortAddress(reviewer.address)}`}
      onClick={(event) => onOpen(reviewer, event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(reviewer);
        }
      }}
    >
      <td>
        <span className="address-mark mono" title={reviewer.address}>
          <AddressIdenticon address={reviewer.address} />
          {shortAddress(reviewer.address)}
        </span>
      </td>
      <td className="num">{reviewer.rows}</td>
      <td className="num">{reviewer.agents}</td>
      {all ? (
        <td title={networkNames(reviewer.chainIds)}>{networkNames(reviewer.chainIds)}</td>
      ) : null}
      <td className="num">
        {reviewer.ratingAverage === null ? '—' : formatNumber(reviewer.ratingAverage)}
      </td>
      <td>
        {reviewer.labels.map((label) => (
          <Hint key={label} text={LABEL_INFO[label].rule}>
            <ReviewerChip label={label} />
          </Hint>
        ))}
        {reviewer.labels.length === 0 ? <span className="muted">—</span> : null}
      </td>
    </tr>
  );
}
