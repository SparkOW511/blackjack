import { RANKS, SUITS, type Card, valueIndex } from "./cards";

/** Returns a uniformly random integer in [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

/**
 * Cryptographically strong, unbiased random integer (rejection sampling avoids modulo bias).
 * This is the same class of RNG certified shuffling machines are held to.
 */
export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  const range = 0x1_0000_0000;
  const limit = range - (range % maxExclusive);
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % maxExclusive;
  }
};

export function buildDecks(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) cards.push({ rank, suit, id: `${d}-${rank}${suit}` });
    }
  }
  return cards;
}

/** Fisher–Yates shuffle: every ordering of the shoe is equally likely. */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt = cryptoRandomInt): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface Shoe {
  decks: number;
  cards: readonly Card[];
  /** Index of the next card to be dealt. */
  position: number;
  /** When `position` reaches this index the shoe is shuffled before the next round. */
  cutIndex: number;
  /** Cards burned face-down after the shuffle: removed from play but never seen. */
  burned: readonly Card[];
  shuffleNumber: number;
}

/**
 * Shuffle a fresh shoe like a casino does: shuffle, place the cut card with a little
 * human variance around the target penetration, then burn the first card face-down.
 */
export function newShoe(
  decks: number,
  penetration: number,
  shuffleNumber = 1,
  randomInt: RandomInt = cryptoRandomInt,
): Shoe {
  const cards = shuffle(buildDecks(decks), randomInt);
  const jitter = Math.round(((randomInt(1001) - 500) / 500) * 0.25 * 52); // ±¼ deck
  const target = Math.round(cards.length * penetration) + (decks > 2 ? jitter : 0);
  const cutIndex = Math.max(26, Math.min(cards.length - 20, target));
  return { decks, cards, position: 1, cutIndex, burned: [cards[0]], shuffleNumber };
}

export function cardsRemaining(shoe: Shoe): number {
  return shoe.cards.length - shoe.position;
}

export function decksRemaining(shoe: Shoe): number {
  return cardsRemaining(shoe) / 52;
}

export function needsShuffle(shoe: Shoe): boolean {
  return shoe.position >= shoe.cutIndex;
}

/** Draws the next card. Returns the card and the advanced shoe (the shoe is never mutated). */
export function draw(shoe: Shoe): [Card, Shoe] {
  if (shoe.position >= shoe.cards.length) {
    // Only reachable with absurd penetration settings; a real dealer would reshuffle the discards.
    const fresh = newShoe(shoe.decks, 0.75, shoe.shuffleNumber + 1);
    return draw(fresh);
  }
  return [shoe.cards[shoe.position], { ...shoe, position: shoe.position + 1 }];
}

/** Composition (by value index) of cards not yet dealt, including burned ones. */
export function undealtComposition(shoe: Shoe): number[] {
  const comp = new Array<number>(10).fill(0);
  for (let i = shoe.position; i < shoe.cards.length; i++) comp[valueIndex(shoe.cards[i].rank)]++;
  for (const card of shoe.burned) comp[valueIndex(card.rank)]++;
  return comp;
}
