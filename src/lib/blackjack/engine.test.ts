import { describe, expect, it } from "vitest";
import { type Card, type Rank, cardValue, handTotal } from "./cards";
import { hiLoValue, trueCount } from "./count";
import { gameReducer, initialGame, type GameState } from "./game";
import { actionEVs, dealerDistribution, standEV } from "./odds";
import { DEFAULT_RULES, type Rules } from "./rules";
import { buildDecks, newShoe, shuffle, undealtComposition, type Shoe } from "./shoe";
import { recommend } from "./strategy";

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: "♠", id: `t${uid++}` });
const cards = (...ranks: Rank[]) => ranks.map(c);
const S17: Rules = { ...DEFAULT_RULES, dealerHitsSoft17: false };

/** A game whose shoe deals exactly `order` (player, dealer up, player, dealer hole, then hits). */
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
    expect(recommend(situation(["5", "4", "7"], "10"), DEFAULT_RULES, -1).move).toBe("hit");
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

describe("game flow", () => {
  it("pays a natural 3:2 and counts the revealed hole card", () => {
    let g = riggedGame(["A", "9", "K", "7"]);
    g = gameReducer(g, { type: "deal", bet: 10 });
    expect(g.phase).toBe("roundOver");
    expect(g.hands[0].outcome).toBe("blackjack");
    expect(g.bankroll).toBe(1015);
    expect(g.runningCount).toBe(-2);
  });

  it("does not count the hole card until it is revealed", () => {
    let g = riggedGame(["10", "5", "7", "2"]);
    g = gameReducer(g, { type: "deal", bet: 10 });
    expect(g.phase).toBe("playerTurn");
    expect(g.runningCount).toBe(0);
  });

  it("settles insurance against a dealer blackjack", () => {
    let g = riggedGame(["10", "A", "9", "K"]);
    g = gameReducer(g, { type: "deal", bet: 10 });
    expect(g.phase).toBe("insurance");
    g = gameReducer(g, { type: "insurance", take: true });
    expect(g.phase).toBe("roundOver");
    expect(g.bankroll).toBe(1000);
  });

  it("splits, deals each hand in turn, and doubles after split", () => {
    let g = riggedGame(["8", "6", "8", "10", "3", "2", "10", "10"]);
    g = gameReducer(g, { type: "deal", bet: 10 });
    g = gameReducer(g, { type: "move", move: "split" });
    expect(g.hands.map((h) => h.cards.length)).toEqual([2, 1]);
    g = gameReducer(g, { type: "move", move: "double" }); // 8,3 + 2 = 13
    expect(g.activeHand).toBe(1);
    expect(g.hands[1].cards.length).toBe(2); // 8,10
    g = gameReducer(g, { type: "move", move: "stand" });
    expect(g.phase).toBe("roundOver");
    expect(g.dealer.length).toBeGreaterThan(2);
    expect(g.stats.totalWagered).toBe(30);
  });

  it("grades a basic-strategy mistake and settles the loss", () => {
    let g = riggedGame(["10", "10", "6", "7"]);
    g = gameReducer(g, { type: "deal", bet: 10 });
    g = gameReducer(g, { type: "move", move: "stand" }); // 16 vs 10 at a negative count: should hit
    expect(g.feedback[0].correct).toBe(false);
    expect(g.feedback[0].recommended).toBe("hit");
    expect(g.bankroll).toBe(990);
  });
});
