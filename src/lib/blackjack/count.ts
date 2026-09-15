import type { Rank } from "./cards";

/** Hi-Lo tag: low cards (2–6) +1, neutral (7–9) 0, high cards (10–A) −1. */
export function hiLoValue(rank: Rank): -1 | 0 | 1 {
  switch (rank) {
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
      return 1;
    case "7":
    case "8":
    case "9":
      return 0;
    default:
      return -1;
  }
}

/** True count = running count ÷ decks remaining. */
export function trueCount(runningCount: number, cardsRemaining: number): number {
  const decks = Math.max(cardsRemaining / 52, 0.25);
  return runningCount / decks;
}

/** Players estimate decks remaining to the nearest half deck by eyeballing the discard tray. */
export function estimateDecksRemaining(cardsRemaining: number): number {
  return Math.max(0.5, Math.round((cardsRemaining / 52) * 2) / 2);
}

/** Truncate toward zero — the convention most Hi-Lo index tables are built on for betting. */
export function flooredTrueCount(tc: number): number {
  return Math.trunc(tc);
}

/** Each +1 true count is worth roughly +0.5% to the player. */
export function playerEdge(baseHouseEdge: number, tc: number): number {
  return -baseHouseEdge + 0.005 * tc;
}

/** A conservative 1–12 spread for a 6/8-deck shoe. Returns bet units. */
export function recommendedUnits(tc: number): number {
  const t = flooredTrueCount(tc);
  if (t <= 1) return 1;
  if (t === 2) return 2;
  if (t === 3) return 4;
  if (t === 4) return 8;
  return 12;
}
