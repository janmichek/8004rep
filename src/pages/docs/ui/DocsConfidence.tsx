import {
  DOMINANT_SHARE,
  STRONG_NEFF,
  STRONG_WEIGHT,
  THIN_WEIGHT,
  THIN_WALLETS,
} from '../../../shared/lib/explorer';

export function DocsConfidence() {
  return (
    <dl className="metric-list">
      <dt>low</dt>
      <dd>
        Under {THIN_WEIGHT} full votes or under {THIN_WALLETS} wallets.
      </dd>
      <dt>medium</dt>
      <dd>Anything between low and high.</dd>
      <dt>high</dt>
      <dd>
        {STRONG_WEIGHT}+ full votes, {STRONG_NEFF}+ effective voices, and no wallet holding{' '}
        {DOMINANT_SHARE * 100}% of the weight.
      </dd>
      <dt>Unrated</dt>
      <dd>No rating rows at all. Telemetry and outcomes are shown but never scored.</dd>
    </dl>
  );
}
