export interface Rules {
  /** Multi-deck only: the strategy tables are the 4–8 deck charts. */
  decks: 2 | 4 | 6 | 8;
  /** H17 when true, S17 when false. */
  dealerHitsSoft17: boolean;
  blackjackPayout: 1.5 | 1.2;
  doubleAfterSplit: boolean;
  /** Fraction of the shoe dealt before the cut card. */
  penetration: number;
  maxHands: number;
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  dealerHitsSoft17: true,
  blackjackPayout: 1.5,
  doubleAfterSplit: true,
  penetration: 0.75,
  maxHands: 4,
};

/**
 * Off-the-top house edge for a basic-strategy player, built from published rule effects
 * (baseline: 6 decks, S17, DAS, no surrender, 3:2, split to 4 hands, no resplit aces).
 * Returned as a positive fraction, e.g. 0.0043 = 0.43%.
 */
export function baseHouseEdge(rules: Rules): number {
  let edge = 0.0043;
  edge += { 2: -0.0019, 4: -0.0006, 6: 0, 8: 0.0002 }[rules.decks];
  if (rules.dealerHitsSoft17) edge += 0.0022;
  if (rules.blackjackPayout === 1.2) edge += 0.0139;
  if (!rules.doubleAfterSplit) edge += 0.0014;
  return edge;
}

export function describeRules(rules: Rules): string {
  return [
    `${rules.decks} decks`,
    rules.dealerHitsSoft17 ? "H17" : "S17",
    rules.blackjackPayout === 1.5 ? "BJ 3:2" : "BJ 6:5",
    rules.doubleAfterSplit ? "DAS" : "no DAS",
    `${Math.round(rules.penetration * 100)}% pen`,
  ].join(" · ");
}
