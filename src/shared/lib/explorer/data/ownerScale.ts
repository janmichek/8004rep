/** Agents at or above this count are a portfolio, not a single registration. */
export const PORTFOLIO_OWNER_AGENTS = 10;
/** Agents at or above this count look like a registration cluster. */
export const MASS_OWNER_AGENTS = 50;

export type OwnerScaleBracket = 'single' | 'small' | 'portfolio' | 'mass';

export type OwnerScale = {
  bracket: OwnerScaleBracket;
  label: string;
  /** One sentence a reader can check against the registry. */
  rule: string;
  /** `warn` only for the mass bracket; the rest are context. */
  level: 'info' | 'warn';
  agents: number;
};

/**
 * How many agents one owner holds. This is a context signal, not proof of
 * spam: platforms and marketplaces legitimately run many agents. The bracket
 * is deliberately visible next to the count so a reader can judge it.
 */
export function ownerScale(agents: number | undefined | null): OwnerScale | null {
  if (agents === undefined || agents === null || agents <= 0) return null;
  if (agents >= MASS_OWNER_AGENTS) {
    return {
      bracket: 'mass',
      label: 'mass registrant',
      rule: `Owner holds ${agents} agents, at or above the ${MASS_OWNER_AGENTS}-agent cluster line. Check whether the registrations are distinct services or one bulk wallet.`,
      level: 'warn',
      agents,
    };
  }
  if (agents >= PORTFOLIO_OWNER_AGENTS) {
    return {
      bracket: 'portfolio',
      label: 'portfolio owner',
      rule: `Owner holds ${agents} agents. A portfolio can be a platform; it is not a finding by itself.`,
      level: 'info',
      agents,
    };
  }
  if (agents >= 2) {
    return {
      bracket: 'small',
      label: 'few agents',
      rule: `Owner holds ${agents} agents.`,
      level: 'info',
      agents,
    };
  }
  return {
    bracket: 'single',
    label: 'single agent',
    rule: 'Owner holds one agent on this network.',
    level: 'info',
    agents,
  };
}
