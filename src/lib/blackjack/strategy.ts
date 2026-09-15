import { type Card, cardValue, handTotal } from "./cards";
import type { Rules } from "./rules";

export type Move = "hit" | "stand" | "double" | "split";

export interface HandSituation {
  cards: readonly Card[];
  dealerUp: Card;
  canDouble: boolean;
  canSplit: boolean;
}

/**
 * Chart codes. D = double else hit, Ds = double else stand, P = split,
 * Ph = split if DAS else hit.
 */
export type Code = "H" | "S" | "D" | "Ds" | "P" | "Ph";

/** Dealer columns: 2 3 4 5 6 7 8 9 T A */
export const DEALER_COLUMNS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"] as const;

const row = (s: string) => s.split(" ") as Code[];

/** Multi-deck S17 DAS charts; `rulesAdjusted` layers on the H17 differences. */
const HARD_S17: Record<number, Code[]> = {
  8: row("H H H H H H H H H H"),
  9: row("H D D D D H H H H H"),
  10: row("D D D D D D D D H H"),
  11: row("D D D D D D D D D H"),
  12: row("H H S S S H H H H H"),
  13: row("S S S S S H H H H H"),
  14: row("S S S S S H H H H H"),
  15: row("S S S S S H H H H H"),
  16: row("S S S S S H H H H H"),
  17: row("S S S S S S S S S S"),
};

const SOFT_S17: Record<number, Code[]> = {
  12: row("H H H H H H H H H H"),
  13: row("H H H D D H H H H H"),
  14: row("H H H D D H H H H H"),
  15: row("H H D D D H H H H H"),
  16: row("H H D D D H H H H H"),
  17: row("H D D D D H H H H H"),
  18: row("S Ds Ds Ds Ds S S H H H"),
  19: row("S S S S S S S S S S"),
  20: row("S S S S S S S S S S"),
};

/** Keyed by the pair's card value (1 = aces, 10 = any two ten-value cards). */
const PAIRS_S17: Record<number, Code[]> = {
  1: row("P P P P P P P P P P"),
  2: row("Ph Ph P P P P H H H H"),
  3: row("Ph Ph P P P P H H H H"),
  4: row("H H H Ph Ph H H H H H"),
  6: row("Ph P P P P H H H H H"),
  7: row("P P P P P P H H H H"),
  8: row("P P P P P P P P P P"),
  9: row("P P P P P S P P S S"),
  10: row("S S S S S S S S S S"),
};

export interface StrategyCharts {
  hard: Record<number, Code[]>;
  soft: Record<number, Code[]>;
  pairs: Record<number, Code[]>;
}

const chartCache = new Map<boolean, StrategyCharts>();

/** Charts for the given rules. The returned tables are shared — treat them as read-only. */
export function strategyCharts(rules: Rules): StrategyCharts {
  const cached = chartCache.get(rules.dealerHitsSoft17);
  if (cached) return cached;
  const hard = cloneChart(HARD_S17);
  const soft = cloneChart(SOFT_S17);
  const pairs = cloneChart(PAIRS_S17);
  if (rules.dealerHitsSoft17) {
    hard[11][9] = "D";
    soft[18][0] = "Ds";
    soft[19][4] = "Ds";
  }
  const charts = { hard, soft, pairs };
  chartCache.set(rules.dealerHitsSoft17, charts);
  return charts;
}

function cloneChart(chart: Record<number, Code[]>): Record<number, Code[]> {
  return Object.fromEntries(Object.entries(chart).map(([k, v]) => [k, [...v]]));
}

export function dealerColumn(up: Card): number {
  const v = cardValue(up.rank);
  return v === 1 ? 9 : v - 2;
}

export function chartCode(situation: HandSituation, rules: Rules): Code {
  const charts = strategyCharts(rules);
  const col = dealerColumn(situation.dealerUp);
  const { cards } = situation;
  const pairValue =
    cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank)
      ? cardValue(cards[0].rank)
      : null;

  if (pairValue !== null && situation.canSplit && charts.pairs[pairValue]) {
    return charts.pairs[pairValue][col];
  }
  const { total, soft } = handTotal(cards);
  if (soft) return charts.soft[Math.min(Math.max(total, 12), 20)][col];
  return charts.hard[Math.min(Math.max(total, 8), 17)][col];
}

export function resolveCode(code: Code, situation: HandSituation, rules: Rules): Move {
  switch (code) {
    case "H":
      return "hit";
    case "S":
      return "stand";
    case "D":
      return situation.canDouble ? "double" : "hit";
    case "Ds":
      return situation.canDouble ? "double" : "stand";
    case "P":
      return "split";
    case "Ph":
      return rules.doubleAfterSplit ? "split" : "hit";
  }
}

export function basicStrategy(situation: HandSituation, rules: Rules): Move {
  return resolveCode(chartCode(situation, rules), situation, rules);
}

export interface Deviation {
  /** e.g. "16 vs 10" */
  hand: string;
  move: Move;
  /** Deviate when the true count is at or above (or at or below) this index. */
  index: number;
  direction: "atLeast" | "atMost";
  note: string;
}

export interface Recommendation {
  move: Move;
  basic: Move;
  deviation: Deviation | null;
}

/**
 * The Illustrious 18 (Hi-Lo, multi-deck). Only the plays that actually
 * change the decision under the current rules are returned.
 */
export function deviationFor(situation: HandSituation, rules: Rules, basic: Move, tc: number): Deviation | null {
  const { cards, dealerUp } = situation;
  const { total, soft } = handTotal(cards);
  const up = cardValue(dealerUp.rank) === 1 ? 11 : cardValue(dealerUp.rank);
  const upLabel = up === 11 ? "A" : String(up);
  const isTenPair = cards.length === 2 && cardValue(cards[0].rank) === 10 && cardValue(cards[1].rank) === 10;
  const candidates: Deviation[] = [];
  const add = (move: Move, index: number, direction: Deviation["direction"], note: string, hand = `${total} vs ${upLabel}`) =>
    candidates.push({ hand, move, index, direction, note });

  if (isTenPair && situation.canSplit) {
    if (up === 5) add("split", 5, "atLeast", "Split tens against a 5 at +5 or higher.", "10,10 vs 5");
    if (up === 6) add("split", 4, "atLeast", "Split tens against a 6 at +4 or higher.", "10,10 vs 6");
  }

  if (!soft) {
    if (total === 16 && up === 10) add("stand", 0, "atLeast", "Stand 16 vs 10 at a count of 0 or higher.");
    if (total === 16 && up === 9) add("stand", 5, "atLeast", "Stand 16 vs 9 at +5.");
    if (total === 15 && up === 10) add("stand", 4, "atLeast", "Stand 15 vs 10 at +4.");
    if (total === 12 && up === 3) add("stand", 2, "atLeast", "Stand 12 vs 3 at +2.");
    if (total === 12 && up === 2) add("stand", 3, "atLeast", "Stand 12 vs 2 at +3.");
    if (total === 12 && up === 4) add("hit", -0.0001, "atMost", "Hit 12 vs 4 when the count goes negative.");
    if (total === 12 && up === 5) add("hit", -2, "atMost", "Hit 12 vs 5 at −2.");
    if (total === 12 && up === 6) add("hit", -1, "atMost", "Hit 12 vs 6 at −1.");
    if (total === 13 && up === 2) add("hit", -1, "atMost", "Hit 13 vs 2 at −1.");
    if (total === 13 && up === 3) add("hit", -2, "atMost", "Hit 13 vs 3 at −2.");
    if (situation.canDouble) {
      if (total === 11 && up === 11 && !rules.dealerHitsSoft17) add("double", 1, "atLeast", "Double 11 vs A at +1.");
      if (total === 10 && up === 10) add("double", 4, "atLeast", "Double 10 vs 10 at +4.");
      if (total === 10 && up === 11) add("double", rules.dealerHitsSoft17 ? 3 : 4, "atLeast", "Double 10 vs A at a high count.");
      if (total === 9 && up === 2) add("double", 1, "atLeast", "Double 9 vs 2 at +1.");
      if (total === 9 && up === 7) add("double", 3, "atLeast", "Double 9 vs 7 at +3.");
    }
  }

  for (const dev of candidates) {
    if (dev.move === basic) continue;
    const triggered = dev.direction === "atLeast" ? tc >= dev.index : tc <= dev.index;
    if (!triggered) continue;
    // A deviation from hit/stand never overrides a basic-strategy double or split.
    if ((dev.move === "hit" || dev.move === "stand") && basic !== "hit" && basic !== "stand") continue;
    return dev;
  }
  return null;
}

export function recommend(situation: HandSituation, rules: Rules, tc: number): Recommendation {
  const basic = basicStrategy(situation, rules);
  const deviation = deviationFor(situation, rules, basic, tc);
  return { move: deviation?.move ?? basic, basic, deviation };
}

export const INSURANCE_INDEX = 3;

export function describeHand(cards: readonly Card[], dealerUp: Card): string {
  const up = dealerUp.rank === "A" ? "A" : String(cardValue(dealerUp.rank));
  if (cards.length === 2 && cardValue(cards[0].rank) === cardValue(cards[1].rank)) {
    const v = cardValue(cards[0].rank);
    return `Pair of ${v === 1 ? "A" : v}s vs ${up}`;
  }
  const { total, soft } = handTotal(cards);
  return `${soft ? "Soft" : "Hard"} ${total} vs ${up}`;
}
