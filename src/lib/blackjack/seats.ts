import { type Card, cardValue, handTotal } from "./cards";
import type { Rules } from "./rules";
import { type RandomInt, cryptoRandomInt } from "./shoe";
import { type Move, basicStrategy } from "./strategy";

/** How an AI seat plays. Real tables are a mix of these. */
export type AiProfile = "solid" | "cautious" | "chaser" | "mimic";

export const PROFILE_LABEL: Record<AiProfile, string> = {
  solid: "Basic strategy",
  cautious: "Never busts a stiff",
  chaser: "Chases every hand",
  mimic: "Plays like the dealer",
};

export interface AiSeatConfig {
  id: string;
  name: string;
  profile: AiProfile;
  /** Flat bet, for show — AI money never touches your bankroll. */
  bet: number;
}

const NAMES = ["Dana", "Ivan", "Marta", "Luis", "Nina", "Otto", "Pia", "Rafe"];
const PROFILES: AiProfile[] = ["solid", "cautious", "chaser", "mimic"];

/** Seats the given number of AI players, at least one of whom plays properly. */
export function createAiSeats(count: number, randomInt: RandomInt = cryptoRandomInt): AiSeatConfig[] {
  const pool = [...NAMES];
  const seats: AiSeatConfig[] = [];
  for (let i = 0; i < count; i++) {
    const name = pool.length ? pool.splice(randomInt(pool.length), 1)[0] : `Seat ${i + 1}`;
    const profile = i === 0 ? "solid" : PROFILES[randomInt(PROFILES.length)];
    seats.push({ id: `ai-${i}-${name}`, name, profile, bet: (randomInt(4) + 1) * 25 });
  }
  return seats;
}

export interface AiContext {
  cards: readonly Card[];
  dealerUp: Card;
  canDouble: boolean;
  canSplit: boolean;
  rules: Rules;
}

/**
 * One decision for an AI seat. Only `solid` plays correctly; the others make the mistakes you
 * actually see at a table. None of them count cards.
 */
export function aiDecision(profile: AiProfile, ctx: AiContext): Move {
  const { total, soft } = handTotal(ctx.cards);
  const pairValue = ctx.canSplit ? cardValue(ctx.cards[0].rank) : null;
  const alwaysSplit = pairValue === 1 || pairValue === 8;

  switch (profile) {
    case "solid":
      return basicStrategy(
        { cards: ctx.cards, dealerUp: ctx.dealerUp, canDouble: ctx.canDouble, canSplit: ctx.canSplit },
        ctx.rules,
      );

    case "cautious":
      // Terrified of busting: stands on every stiff hand regardless of the dealer's card.
      if (alwaysSplit) return "split";
      if (ctx.canDouble && !soft && total === 11) return "double";
      if (soft) return total <= 17 ? "hit" : "stand";
      return total >= 12 ? "stand" : "hit";

    case "chaser":
      // Hits everything and doubles wide.
      if (alwaysSplit) return "split";
      if (ctx.canDouble && !soft && total >= 9 && total <= 11) return "double";
      if (soft) return total <= 18 ? "hit" : "stand";
      return total <= 16 ? "hit" : "stand";

    case "mimic":
      // Plays the dealer's own rules, never doubling or splitting.
      if (soft) return total <= 17 ? "hit" : "stand";
      return total <= 16 ? "hit" : "stand";
  }
}
