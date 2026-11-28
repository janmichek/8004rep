import { describe, expect, it } from 'vitest';
import { MASS_OWNER_AGENTS, PORTFOLIO_OWNER_AGENTS, ownerScale } from './ownerScale';

describe('ownerScale', () => {
  it('brackets a single owner', () => {
    expect(ownerScale(1)).toMatchObject({ bracket: 'single', level: 'info', agents: 1 });
  });

  it('calls 10 through 49 a portfolio', () => {
    expect(ownerScale(PORTFOLIO_OWNER_AGENTS)).toMatchObject({
      bracket: 'portfolio',
      level: 'info',
    });
    expect(ownerScale(MASS_OWNER_AGENTS - 1)).toMatchObject({ bracket: 'portfolio' });
  });

  it('warns at the mass line', () => {
    expect(ownerScale(MASS_OWNER_AGENTS)).toMatchObject({ bracket: 'mass', level: 'warn' });
    expect(ownerScale(991)?.rule).toContain('991');
  });

  it('returns null when the count is unknown', () => {
    expect(ownerScale(undefined)).toBeNull();
    expect(ownerScale(null)).toBeNull();
    expect(ownerScale(0)).toBeNull();
    expect(ownerScale(-1)).toBeNull();
  });
});
