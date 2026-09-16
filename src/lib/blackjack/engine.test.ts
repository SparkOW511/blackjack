import { describe, expect, it } from "vitest";
import { type Card, type Rank, cardValue, handTotal } from "./cards";
import { hiLoValue, trueCount } from "./count";
import {
  type GameState,
  advanceUntilInput,
  gameReducer,
  initialGame,
  isYourTurn,
  stepRound,
  yourSeat,
} from "./game";
import { actionEVs, dealerDistribution, standEV } from "./odds";
import { DEFAULT_RULES, type Rules } from "./rules";
import { type AiSeatConfig, aiDecision } from "./seats";
import { buildDecks, newShoe, shuffle, undealtComposition, type Shoe } from "./shoe";
import { recommend } from "./strategy";

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: "♠", id: `t${uid++}` });
const cards = (...ranks: Rank[]) => ranks.map(c);
const S17: Rules = { ...DEFAULT_RULES, dealerHitsSoft17: false };

/** A game whose shoe deals `order` in sequence, after the burn card. */
function riggedGame(order: Rank[], rules: Rules = DEFAULT_RULES): GameState {
  const filler = buildDecks(6);
  const shoe: Shoe = {
    decks: 6,
    cards: [c("5"), ...cards(...order), ...filler],
    position: 1,
    cutIndex: 10_000,
    burned: [],
    shuffleNumber: 1,
  };
  return { ...initialGame(rules, 1000), shoe };
}

/** Deals a round and runs the table until it needs your decision. */
function start(order: Rank[], { bet = 10, ai = [] as AiSeatConfig[], rules = DEFAULT_RULES } = {}): GameState {
  return advanceUntilInput(gameReducer(riggedGame(order, rules), { type: "deal", bet, ai }));
}

const move = (g: GameState, m: "hit" | "stand" | "double" | "split") =>
  advanceUntilInput(gameReducer(g, { type: "move", move: m }));

describe("shoe", () => {
  it("shuffles into a permutation of the same cards", () => {
    const deck = buildDecks(6);
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(312);
    expect(new Set(shuffled.map((x) => x.id)).size).toBe(312);
    expect(shuffled.map((x) => x.id)).not.toEqual(deck.map((x) => x.id));
  });

  it("burns one card and places the cut card near the target penetration", () => {
    const shoe = newShoe(6, 0.75);
    expect(shoe.position).toBe(1);
    expect(shoe.burned).toHaveLength(1);
    expect(shoe.cutIndex).toBeGreaterThanOrEqual(234 - 13);
    expect(shoe.cutIndex).toBeLessThanOrEqual(234 + 13);
    expect(undealtComposition(shoe).reduce((a, b) => a + b)).toBe(312);
  });
});

describe("Hi-Lo", () => {
  it("balances to zero over a full deck", () => {
    expect(buildDecks(1).reduce((sum, card) => sum + hiLoValue(card.rank), 0)).toBe(0);
  });

  it("converts running count to true count per deck remaining", () => {
    expect(trueCount(6, 156)).toBe(2);
  });
});

describe("hand totals", () => {
  it("handles soft and hard aces", () => {
    expect(handTotal(cards("A", "6"))).toEqual({ total: 17, soft: true });
    expect(handTotal(cards("A", "6", "10"))).toEqual({ total: 17, soft: false });
    expect(handTotal(cards("A", "A", "9"))).toEqual({ total: 21, soft: true });
  });
});

describe("strategy", () => {
  const situation = (hand: Rank[], up: Rank, opts: Partial<{ d: boolean; p: boolean }> = {}) => ({
    cards: cards(...hand),
    dealerUp: c(up),
    canDouble: opts.d ?? hand.length === 2,
    canSplit: opts.p ?? (hand.length === 2 && cardValue(hand[0]) === cardValue(hand[1])),
  });

  it("follows the basic strategy chart", () => {
    expect(recommend(situation(["10", "6"], "10"), DEFAULT_RULES, 0).basic).toBe("hit");
    expect(recommend(situation(["A", "7"], "2"), DEFAULT_RULES, 0).move).toBe("double");
    expect(recommend(situation(["A", "7"], "2"), S17, 0).move).toBe("stand");
    expect(recommend(situation(["8", "8"], "A"), DEFAULT_RULES, 0).move).toBe("split");
    expect(recommend(situation(["10", "5"], "A"), DEFAULT_RULES, 0).move).toBe("hit");
    expect(recommend(situation(["6", "5"], "A"), S17, 0).move).toBe("hit");
    expect(recommend(situation(["5", "5"], "9"), DEFAULT_RULES, 0).move).toBe("double");
  });

  it("stands on hard 17 and higher vs A under H17", () => {
    expect(recommend(situation(["10", "7"], "A"), DEFAULT_RULES, 0).move).toBe("stand");
    expect(recommend(situation(["10", "8"], "A"), DEFAULT_RULES, 0).move).toBe("stand");
    expect(recommend(situation(["K", "Q"], "A"), DEFAULT_RULES, 0).move).toBe("stand");
  });

  it("applies count-based deviations", () => {
    expect(recommend(situation(["5", "4", "7"], "10"), DEFAULT_RULES, 1).move).toBe("stand");
    expect(recommend(situation(["10", "6"], "10"), DEFAULT_RULES, 0.5).move).toBe("stand");
    expect(recommend(situation(["6", "5"], "A"), S17, 1.2).move).toBe("double");
    expect(recommend(situation(["K", "Q"], "6"), DEFAULT_RULES, 4.1).move).toBe("split");
    expect(recommend(situation(["10", "2"], "3"), DEFAULT_RULES, 2).move).toBe("stand");
    expect(recommend(situation(["10", "2"], "4"), DEFAULT_RULES, -0.5).move).toBe("hit");
    expect(recommend(situation(["10", "5"], "10"), DEFAULT_RULES, -1).move).toBe("hit");
  });
});

describe("odds", () => {
  const fresh = () => undealtComposition(newShoe(6, 0.75));

  it("dealer distribution sums to 1 and matches published bust rates", () => {
    const dist = dealerDistribution(c("6"), fresh(), false, false);
    expect(dist.reduce((a, b) => a + b)).toBeCloseTo(1, 9);
    expect(dist[5]).toBeGreaterThan(0.41);
    expect(dist[5]).toBeLessThan(0.44);
  });

  it("conditions on no blackjack after a peek", () => {
    const dist = dealerDistribution(c("A"), fresh(), true, true);
    expect(dist.reduce((a, b) => a + b)).toBeCloseTo(1, 9);
    expect(dist[4]).toBeLessThan(0.1);
  });

  it("values actions sensibly", () => {
    const comp = fresh();
    const vs6 = dealerDistribution(c("6"), comp, true, false);
    expect(standEV(20, vs6)).toBeGreaterThan(0.6);
    const evs = actionEVs({
      cards: cards("6", "5"), dealer: vs6, composition: comp,
      canDouble: true, canSplit: false, doubleAfterSplit: true,
    });
    expect(evs.double!).toBeGreaterThan(evs.hit);
    expect(evs.hit).toBeGreaterThan(evs.stand);
  });
});

describe("paced dealing", () => {
  const twoBots: AiSeatConfig[] = [
    { id: "a", name: "Ana", profile: "solid", bet: 25 },
    { id: "b", name: "Bo", profile: "solid", bet: 25 },
  ];

  it("deals one card at a time in casino order, counting each as it lands", () => {
    let g = gameReducer(riggedGame(["2", "3", "4", "5", "6", "7", "8", "9"]), { type: "deal", bet: 10, ai: twoBots });
    expect(g.phase).toBe("dealing");

    const counts: number[] = [];
    for (let i = 0; i < 8; i++) {
      g = stepRound(g);
      counts.push(g.runningCount);
    }

    // 2,3,4,5,6 are +1 each; 7,8 are neutral; the hole card (9) is face-down and uncounted.
    expect(counts).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(g.seats.map((s) => s.hands[0].cards.map((card) => card.rank))).toEqual([
      ["2", "6"],
      ["3", "7"],
      ["4", "8"],
    ]);
    expect(g.dealer.map((card) => card.rank)).toEqual(["5", "9"]);
    expect(g.phase).toBe("seatTurn");
  });

  it("waits for you and lets the bots act on their own", () => {
    const g = start(["2", "3", "4", "5", "6", "7", "8", "9"], { ai: twoBots });
    expect(isYourTurn(g)).toBe(true);
    // Both bots stood or finished before the turn reached you.
    expect(g.activeSeat).toBe(g.youIndex);
    expect(g.seats[0].hands[0].done || g.seats[0].hands[0].cards.length > 2).toBe(true);
  });

  it("keeps other players' money out of your bankroll and stats", () => {
    let g = start(["10", "6", "9", "7", "5", "4"], { ai: [{ id: "a", name: "Dana", profile: "chaser", bet: 100 }] });
    expect(isYourTurn(g)).toBe(true);
    g = move(g, "stand");
    expect(g.phase).toBe("roundOver");
    expect(g.stats.totalWagered).toBe(10);
    expect(g.stats.wins + g.stats.losses + g.stats.pushes).toBe(1);
    expect([990, 1000, 1010]).toContain(g.bankroll);
  });
});

describe("game flow", () => {
  it("pays a natural 3:2 and turns the hole card over", () => {
    const g = start(["A", "9", "K", "7"]);
    expect(g.phase).toBe("roundOver");
    expect(yourSeat(g)!.hands[0].outcome).toBe("blackjack");
    expect(g.bankroll).toBe(1015);
    // Every card that leaves the shoe is seen, so the count never drifts from the true shoe.
    expect(g.holeRevealed).toBe(true);
    expect(g.runningCount).toBe(-2);
  });

  it("does not count the hole card until it is revealed", () => {
    const g = start(["10", "5", "7", "2"]);
    expect(isYourTurn(g)).toBe(true);
    expect(g.runningCount).toBe(0);
  });

  it("settles insurance against a dealer blackjack", () => {
    let g = start(["10", "A", "9", "K"]);
    expect(g.phase).toBe("insurance");
    g = advanceUntilInput(gameReducer(g, { type: "insurance", take: true }));
    expect(g.phase).toBe("roundOver");
    expect(g.bankroll).toBe(1000);
  });

  it("splits, deals each hand in turn, and doubles after split", () => {
    let g = start(["8", "6", "8", "10", "3", "2", "10", "10"]);
    g = move(g, "split");
    const seat = yourSeat(g)!;
    expect(seat.hands).toHaveLength(2);
    expect(seat.hands[0].cards).toHaveLength(2);
    g = move(g, "double"); // 8,3 + 2 = 13
    expect(yourSeat(g)!.activeHand).toBe(1);
    expect(yourSeat(g)!.hands[1].cards).toHaveLength(2); // 8,10
    g = move(g, "stand");
    expect(g.phase).toBe("roundOver");
    expect(g.dealer.length).toBeGreaterThan(2);
    expect(g.stats.totalWagered).toBe(30);
  });

  it("grades a basic-strategy mistake and settles the loss", () => {
    let g = start(["10", "10", "6", "7"]);
    g = move(g, "stand"); // 16 vs 10 at a negative count: should hit
    expect(g.feedback[0].correct).toBe(false);
    expect(g.feedback[0].recommended).toBe("hit");
    expect(g.bankroll).toBe(990);
  });
});

describe("AI profiles", () => {
  const ctx = (hand: Rank[], up: Rank) => ({
    cards: cards(...hand),
    dealerUp: c(up),
    canDouble: hand.length === 2,
    canSplit: hand.length === 2 && cardValue(hand[0]) === cardValue(hand[1]),
    rules: DEFAULT_RULES,
  });

  it("solid plays basic strategy", () => {
    expect(aiDecision("solid", ctx(["10", "6"], "6"))).toBe("stand");
    expect(aiDecision("solid", ctx(["10", "6"], "10"))).toBe("hit");
  });

  it("cautious never busts a stiff hand", () => {
    expect(aiDecision("cautious", ctx(["10", "6"], "10"))).toBe("stand");
    expect(aiDecision("cautious", ctx(["10", "2"], "7"))).toBe("stand");
    expect(aiDecision("cautious", ctx(["5", "4"], "9"))).toBe("hit");
  });

  it("chaser hits stiffs even against a bust card", () => {
    expect(aiDecision("chaser", ctx(["10", "6"], "6"))).toBe("hit");
    expect(aiDecision("chaser", ctx(["A", "7"], "6"))).toBe("hit");
  });

  it("mimic plays the dealer's own rules", () => {
    expect(aiDecision("mimic", ctx(["A", "6"], "10"))).toBe("hit");
    expect(aiDecision("mimic", ctx(["10", "6"], "5"))).toBe("hit");
    expect(aiDecision("mimic", ctx(["10", "7"], "10"))).toBe("stand");
  });

  it("always splits aces and eights", () => {
    for (const profile of ["cautious", "chaser"] as const) {
      expect(aiDecision(profile, ctx(["A", "A"], "6"))).toBe("split");
      expect(aiDecision(profile, ctx(["8", "8"], "10"))).toBe("split");
    }
  });
});
