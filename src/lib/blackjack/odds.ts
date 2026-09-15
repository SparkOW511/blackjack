import { type Card, cardValue, totalFromHard, valueIndex } from "./cards";

/** Dealer final-total probabilities: [17, 18, 19, 20, 21, bust]. */
export type DealerDistribution = [number, number, number, number, number, number];

export const DEALER_OUTCOME_LABELS = ["17", "18", "19", "20", "21", "Bust"] as const;

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Exact dealer outcome probabilities, drawing without replacement from the unseen cards.
 * When the dealer has peeked (ace or ten up) the hole card is conditioned on "not blackjack",
 * which is what the table knows once play reaches the player.
 */
export function dealerDistribution(
  up: Card,
  composition: readonly number[],
  hitsSoft17: boolean,
  peekedNoBlackjack: boolean,
): DealerDistribution {
  const comp = composition.slice();
  const out: DealerDistribution = [0, 0, 0, 0, 0, 0];
  const upIdx = valueIndex(up.rank);

  const recurse = (hard: number, hasAce: boolean, prob: number, left: number) => {
    const { total, soft } = totalFromHard(hard, hasAce);
    if (total > 21) {
      out[5] += prob;
      return;
    }
    if (total > 17 || (total === 17 && !(soft && hitsSoft17))) {
      out[total - 17] += prob;
      return;
    }
    for (let i = 0; i < 10; i++) {
      if (comp[i] === 0) continue;
      const p = comp[i] / left;
      comp[i]--;
      recurse(hard + i + 1, hasAce || i === 0, prob * p, left - 1);
      comp[i]++;
    }
  };

  const left = sum(comp);
  const excluded = peekedNoBlackjack ? (upIdx === 0 ? 9 : upIdx === 9 ? 0 : -1) : -1;
  const denom = left - (excluded >= 0 ? comp[excluded] : 0);
  if (denom <= 0) return out;
  for (let i = 0; i < 10; i++) {
    if (i === excluded || comp[i] === 0) continue;
    const p = comp[i] / denom;
    comp[i]--;
    recurse(upIdx + 1 + i + 1, upIdx === 0 || i === 0, p, left - 1);
    comp[i]++;
  }
  return out;
}

export function standEV(total: number, dealer: DealerDistribution): number {
  if (total > 21) return -1;
  let ev = dealer[5];
  for (let k = 0; k < 5; k++) {
    const dealerTotal = 17 + k;
    if (dealerTotal < total) ev += dealer[k];
    else if (dealerTotal > total) ev -= dealer[k];
  }
  return ev;
}

export interface ActionEVs {
  stand: number;
  hit: number;
  double: number | null;
  split: number | null;
}

interface EVInput {
  cards: readonly Card[];
  dealer: DealerDistribution;
  composition: readonly number[];
  canDouble: boolean;
  canSplit: boolean;
  doubleAfterSplit: boolean;
}

/**
 * Expected value of each action in units of the original bet. The dealer distribution is exact
 * for the current shoe; the player's future draws use the same composition (a close
 * approximation that ignores how the player's own hits shift the dealer's odds). Split EV
 * ignores resplits.
 */
export function actionEVs(input: EVInput): ActionEVs {
  const { dealer, composition } = input;
  const n = sum(composition);
  const p = composition.map((c) => (n > 0 ? c / n : 0));
  const memo = new Map<number, number>();

  const best = (hard: number, hasAce: boolean): number => {
    const key = hard * 2 + (hasAce ? 1 : 0);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const value = Math.max(standEV(totalFromHard(hard, hasAce).total, dealer), hit(hard, hasAce));
    memo.set(key, value);
    return value;
  };
  const hit = (hard: number, hasAce: boolean): number => {
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      if (p[i] === 0) continue;
      const h = hard + i + 1;
      ev += p[i] * (h > 21 ? -1 : best(h, hasAce || i === 0));
    }
    return ev;
  };
  const double = (hard: number, hasAce: boolean): number => {
    let ev = 0;
    for (let i = 0; i < 10; i++) ev += p[i] * standEV(totalFromHard(hard + i + 1, hasAce || i === 0).total, dealer);
    return 2 * ev;
  };

  let hard = 0;
  let hasAce = false;
  for (const c of input.cards) {
    hard += cardValue(c.rank);
    if (c.rank === "A") hasAce = true;
  }

  let split: number | null = null;
  if (input.canSplit) {
    const v = cardValue(input.cards[0].rank);
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      if (p[i] === 0) continue;
      const h = v + i + 1;
      const ace = v === 1 || i === 0;
      if (v === 1) ev += p[i] * standEV(totalFromHard(h, ace).total, dealer);
      else ev += p[i] * Math.max(best(h, ace), input.doubleAfterSplit ? double(h, ace) : -Infinity);
    }
    split = 2 * ev;
  }

  return {
    stand: standEV(totalFromHard(hard, hasAce).total, dealer),
    hit: hit(hard, hasAce),
    double: input.canDouble ? double(hard, hasAce) : null,
    split,
  };
}

export function bustProbabilityIfHit(cards: readonly Card[], composition: readonly number[]): number {
  let hard = 0;
  for (const c of cards) hard += cardValue(c.rank);
  const n = sum(composition);
  if (n === 0) return 0;
  let bust = 0;
  for (let i = 0; i < 10; i++) if (hard + i + 1 > 21) bust += composition[i];
  return bust / n;
}

export interface NextCardOdds {
  ten: number;
  ace: number;
  low: number;
  neutral: number;
}

export function nextCardOdds(composition: readonly number[]): NextCardOdds {
  const n = sum(composition) || 1;
  return {
    ten: composition[9] / n,
    ace: composition[0] / n,
    low: sum(composition.slice(1, 6)) / n,
    neutral: sum(composition.slice(6, 9)) / n,
  };
}
