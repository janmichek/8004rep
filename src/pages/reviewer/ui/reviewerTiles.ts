import {
  MIN_NONCE,
  formatNumber,
  formatPercent,
  formatScore,
  type ReviewerProfile,
} from '../../../shared/lib/explorer';
import type { Tile } from '../../../shared/ui';
import type { ReviewerWallet } from './useReviewerWallet';

function feedbackTile(profile: ReviewerProfile): Tile {
  return {
    label: 'Feedback',
    value: String(profile.rows),
    hint: profile.revoked ? `${profile.revoked} revoked` : 'none revoked',
    tone: 'main',
  };
}

function agentsTile(profile: ReviewerProfile): Tile {
  const topAgent = profile.perAgent[0];

  return {
    label: 'Agents rated',
    value: String(profile.agents),
    hint: topAgent ? `most on #${topAgent.tokenId} (${topAgent.rows})` : '',
  };
}

function averageTile(profile: ReviewerProfile): Tile {
  return {
    label: 'Average rating',
    value: profile.ratingAverage === null ? '—' : formatNumber(profile.ratingAverage),
    hint: `${profile.ratingRows} scored rating${profile.ratingRows === 1 ? '' : 's'}, normalised`,
    meter:
      profile.ratingAverage === null ? undefined : { kind: 'gauge', value: profile.ratingAverage },
  };
}

function modeTile(profile: ReviewerProfile): Tile {
  const mode = profile.ratingMode;

  return {
    label: 'Most common rating',
    value: mode ? formatScore(mode.value) : '—',
    hint: mode ? `${formatPercent(mode.share)} of scored ratings` : '',
    tone: profile.labels.includes('rubber-stamp') ? 'warn' : undefined,
    meter: mode ? { kind: 'gauge', value: mode.value } : undefined,
  };
}

function busiestTile(profile: ReviewerProfile): Tile {
  return {
    label: 'Busiest 24h',
    value: String(profile.peakPerDay),
    hint: 'feedback in one day',
    tone: profile.labels.includes('bulk') ? 'warn' : undefined,
  };
}

function walletTile(wallet: ReviewerWallet | null | undefined, walletLoading: boolean): Tile {
  const nonce = wallet?.nonce;

  return {
    label: 'Wallet',
    value: nonce === undefined ? '—' : `${nonce} tx`,
    hint: wallet?.kind ?? '',
    title: `Transactions sent. Under ${MIN_NONCE} is a fresh wallet.`,
    tone: nonce !== undefined && nonce < MIN_NONCE ? 'warn' : undefined,
    loading: walletLoading,
  };
}

export function reviewerTiles(
  profile: ReviewerProfile,
  wallet: ReviewerWallet | null | undefined,
  walletLoading: boolean
): Tile[] {
  return [
    feedbackTile(profile),
    agentsTile(profile),
    averageTile(profile),
    modeTile(profile),
    busiestTile(profile),
    walletTile(wallet, walletLoading),
  ];
}
