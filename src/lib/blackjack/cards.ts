export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Unique within a shoe, so React can key dealt cards. */
  id: string;
}

/** Blackjack value with aces counted as 1. */
export function cardValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/**
 * Index into a 10-slot composition array: 0 = ace, 1..8 = 2..9, 9 = any ten-value card.
 */
export function valueIndex(rank: Rank): number {
  return cardValue(rank) - 1;
}

export function isRed(suit: Suit): boolean {
  return suit === "♥" || suit === "♦";
}

export interface HandTotal {
  total: number;
  soft: boolean;
}

export function handTotal(cards: readonly Card[]): HandTotal {
  let hard = 0;
  let hasAce = false;
  for (const card of cards) {
    hard += cardValue(card.rank);
    if (card.rank === "A") hasAce = true;
  }
  return totalFromHard(hard, hasAce);
}

export function totalFromHard(hard: number, hasAce: boolean): HandTotal {
  if (hasAce && hard + 10 <= 21) return { total: hard + 10, soft: true };
  return { total: hard, soft: false };
}

export function isBlackjack(cards: readonly Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

export function isBust(cards: readonly Card[]): boolean {
  return handTotal(cards).total > 21;
}
