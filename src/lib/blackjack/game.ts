import { type Card, cardValue, handTotal, isBlackjack, valueIndex } from "./cards";
import { hiLoValue, trueCount } from "./count";
import { type Rules, DEFAULT_RULES } from "./rules";
import { type RandomInt, type Shoe, cardsRemaining, cryptoRandomInt, draw, needsShuffle, newShoe, undealtComposition } from "./shoe";
import { type Move, type Recommendation, INSURANCE_INDEX, describeHand, recommend } from "./strategy";

export type Phase = "betting" | "insurance" | "playerTurn" | "roundOver";
export type Outcome = "win" | "lose" | "push" | "blackjack" | "bust";

export interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  fromSplit: boolean;
  outcome?: Outcome;
  /** Amount returned to the player at settlement, stake included. */
  payout?: number;
}

export interface DecisionFeedback {
  hand: string;
  move: Move | "insurance" | "no insurance";
  recommended: Move | "insurance" | "no insurance";
  basic: Move | "insurance" | "no insurance";
  deviationNote: string | null;
  correct: boolean;
  trueCount: number;
}

export interface Stats {
  rounds: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  decisions: number;
  correctDecisions: number;
  deviationSpots: number;
  deviationsCorrect: number;
  totalWagered: number;
  net: number;
}

export interface GameState {
  rules: Rules;
  shoe: Shoe;
  bankroll: number;
  phase: Phase;
  hands: PlayerHand[];
  activeHand: number;
  dealer: Card[];
  holeRevealed: boolean;
  /** Hi-Lo count of every card the player has seen since the shuffle. */
  runningCount: number;
  insurance: number;
  lastBet: number;
  /** True for the round dealt immediately after a shuffle. */
  shuffledThisRound: boolean;
  roundNet: number;
  feedback: DecisionFeedback[];
  stats: Stats;
}

export type GameAction =
  | { type: "deal"; bet: number }
  | { type: "insurance"; take: boolean }
  | { type: "move"; move: Move }
  | { type: "shuffle" }
  | { type: "setRules"; rules: Rules }
  | { type: "setBankroll"; bankroll: number }
  | { type: "resetSession"; bankroll: number };

export const EMPTY_STATS: Stats = {
  rounds: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  blackjacks: 0,
  decisions: 0,
  correctDecisions: 0,
  deviationSpots: 0,
  deviationsCorrect: 0,
  totalWagered: 0,
  net: 0,
};

export function initialGame(
  rules: Rules = DEFAULT_RULES,
  bankroll = 1000,
  stats: Stats = EMPTY_STATS,
  randomInt: RandomInt = cryptoRandomInt,
): GameState {
  return {
    rules,
    shoe: newShoe(rules.decks, rules.penetration, 1, randomInt),
    bankroll,
    phase: "betting",
    hands: [],
    activeHand: 0,
    dealer: [],
    holeRevealed: false,
    runningCount: 0,
    insurance: 0,
    lastBet: 10,
    shuffledThisRound: true,
    roundNet: 0,
    feedback: [],
    stats,
  };
}

// ---------- derived values ----------

export function currentTrueCount(state: GameState): number {
  return trueCount(state.runningCount, cardsRemaining(state.shoe));
}

/** Cards the player cannot see: the undealt shoe, burn cards, and the dealer's hole card. */
export function unseenComposition(state: GameState): number[] {
  const comp = undealtComposition(state.shoe);
  if (state.dealer.length > 1 && !state.holeRevealed) comp[valueIndex(state.dealer[1].rank)]++;
  return comp;
}

export function dealerUpcard(state: GameState): Card | undefined {
  return state.dealer[0];
}

export function dealerPeeked(state: GameState): boolean {
  const up = state.dealer[0];
  return !!up && (up.rank === "A" || cardValue(up.rank) === 10);
}

export interface LegalMoves {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
}

export function legalMoves(state: GameState): LegalMoves {
  const hand = state.hands[state.activeHand];
  if (state.phase !== "playerTurn" || !hand || hand.done) {
    return { hit: false, stand: false, double: false, split: false };
  }
  const twoCards = hand.cards.length === 2;
  const affordable = state.bankroll >= hand.bet;
  return {
    hit: true,
    stand: true,
    double: twoCards && affordable && (!hand.fromSplit || state.rules.doubleAfterSplit),
    split:
      twoCards &&
      affordable &&
      state.hands.length < state.rules.maxHands &&
      cardValue(hand.cards[0].rank) === cardValue(hand.cards[1].rank),
  };
}

export function recommendation(state: GameState): Recommendation | null {
  const hand = state.hands[state.activeHand];
  const up = dealerUpcard(state);
  if (state.phase !== "playerTurn" || !hand || !up) return null;
  const legal = legalMoves(state);
  return recommend(
    { cards: hand.cards, dealerUp: up, canDouble: legal.double, canSplit: legal.split },
    state.rules,
    currentTrueCount(state),
  );
}

// ---------- reducer ----------

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "deal":
      return deal(state, action.bet);
    case "insurance":
      return resolveInsurance(state, action.take);
    case "move":
      return applyMove(state, action.move);
    case "shuffle":
      if (state.phase !== "betting" && state.phase !== "roundOver") return state;
      return reshuffle(state);
    case "setRules":
      if (state.phase !== "betting" && state.phase !== "roundOver") return state;
      return { ...initialGame(action.rules, state.bankroll, state.stats), lastBet: state.lastBet };
    case "setBankroll":
      if (state.phase !== "betting" && state.phase !== "roundOver") return state;
      return { ...state, bankroll: action.bankroll };
    case "resetSession":
      if (state.phase !== "betting" && state.phase !== "roundOver") return state;
      return initialGame(state.rules, action.bankroll, EMPTY_STATS);
  }
}

function reshuffle(state: GameState): GameState {
  return {
    ...state,
    shoe: newShoe(state.rules.decks, state.rules.penetration, state.shoe.shuffleNumber + 1),
    runningCount: 0,
    shuffledThisRound: true,
    hands: [],
    dealer: [],
    holeRevealed: false,
    phase: "betting",
  };
}

/** Draws a card; `visible` cards are added to the running count. */
function drawCard(state: GameState, visible = true): [Card, GameState] {
  const [card, shoe] = draw(state.shoe);
  return [card, { ...state, shoe, runningCount: state.runningCount + (visible ? hiLoValue(card.rank) : 0) }];
}

function deal(prev: GameState, bet: number): GameState {
  if (prev.phase !== "betting" && prev.phase !== "roundOver") return prev;
  if (!(bet > 0) || bet > prev.bankroll) return prev;

  const start: GameState = needsShuffle(prev.shoe) ? reshuffle(prev) : { ...prev, shuffledThisRound: false };
  const [p1, s1] = drawCard(start);
  const [d1, s2] = drawCard(s1);
  const [p2, s3] = drawCard(s2);
  const [d2, s4] = drawCard(s3, false);

  const state: GameState = {
    ...s4,
    bankroll: s4.bankroll - bet,
    lastBet: bet,
    hands: [{ cards: [p1, p2], bet, doubled: false, done: false, fromSplit: false }],
    activeHand: 0,
    dealer: [d1, d2],
    holeRevealed: false,
    insurance: 0,
    roundNet: 0,
    feedback: [],
    phase: "insurance",
  };

  if (d1.rank === "A") return state;
  return afterPeek(state);
}

function resolveInsurance(prev: GameState, take: boolean): GameState {
  if (prev.phase !== "insurance") return prev;
  const tc = currentTrueCount(prev);
  const recommended = tc >= INSURANCE_INDEX ? "insurance" : "no insurance";
  const move = take ? "insurance" : "no insurance";
  const feedback: DecisionFeedback = {
    hand: `Insurance vs A (${describeHand(prev.hands[0].cards, prev.dealer[0]).split(" vs")[0]})`,
    move,
    recommended,
    basic: "no insurance",
    deviationNote: recommended === "insurance" ? "Take insurance at a true count of +3 or higher." : null,
    correct: move === recommended,
    trueCount: tc,
  };
  const amount = take ? Math.min(prev.hands[0].bet / 2, prev.bankroll) : 0;
  return afterPeek({
    ...prev,
    insurance: amount,
    bankroll: prev.bankroll - amount,
    feedback: [...prev.feedback, feedback],
    stats: recordDecision(prev.stats, feedback),
  });
}

function afterPeek(state: GameState): GameState {
  const dealerBJ = dealerPeeked(state) && isBlackjack(state.dealer);
  if (dealerBJ || isBlackjack(state.hands[0].cards)) {
    return settle(revealHole({ ...state, hands: state.hands.map((h) => ({ ...h, done: true })) }));
  }
  return { ...state, phase: "playerTurn", activeHand: 0 };
}

function recordDecision(stats: Stats, fb: DecisionFeedback): Stats {
  const isDeviation = fb.recommended !== fb.basic;
  return {
    ...stats,
    decisions: stats.decisions + 1,
    correctDecisions: stats.correctDecisions + (fb.correct ? 1 : 0),
    deviationSpots: stats.deviationSpots + (isDeviation ? 1 : 0),
    deviationsCorrect: stats.deviationsCorrect + (isDeviation && fb.correct ? 1 : 0),
  };
}

function applyMove(prev: GameState, move: Move): GameState {
  const legal = legalMoves(prev);
  if (!legal[move]) return prev;

  const rec = recommendation(prev)!;
  const handBefore = prev.hands[prev.activeHand];
  const feedback: DecisionFeedback = {
    hand: describeHand(handBefore.cards, prev.dealer[0]),
    move,
    recommended: rec.move,
    basic: rec.basic,
    deviationNote: rec.deviation?.note ?? null,
    correct: move === rec.move,
    trueCount: currentTrueCount(prev),
  };
  let state: GameState = { ...prev, feedback: [...prev.feedback, feedback], stats: recordDecision(prev.stats, feedback) };

  const hands = state.hands.map((h) => ({ ...h, cards: [...h.cards] }));
  const hand = hands[state.activeHand];
  let card: Card;

  switch (move) {
    case "hit":
      [card, state] = drawCard(state);
      hand.cards.push(card);
      if (handTotal(hand.cards).total >= 21) hand.done = true;
      break;
    case "stand":
      hand.done = true;
      break;
    case "double":
      state = { ...state, bankroll: state.bankroll - hand.bet };
      hand.bet *= 2;
      hand.doubled = true;
      [card, state] = drawCard(state);
      hand.cards.push(card);
      hand.done = true;
      break;
    case "split": {
      state = { ...state, bankroll: state.bankroll - hand.bet };
      const second: PlayerHand = { ...hand, cards: [hand.cards[1]], fromSplit: true };
      hand.cards = [hand.cards[0]];
      hand.fromSplit = true;
      hands.splice(state.activeHand + 1, 0, second);
      [card, state] = drawCard(state);
      hand.cards.push(card);
      if (hand.cards[0].rank === "A" || handTotal(hand.cards).total === 21) hand.done = true;
      break;
    }
  }

  return advance({ ...state, hands });
}

/** Moves to the next unfinished hand, dealing split hands their second card; then plays the dealer. */
function advance(prev: GameState): GameState {
  let state = prev;
  const hands = state.hands.map((h) => ({ ...h, cards: [...h.cards] }));
  let active = state.activeHand;

  while (active < hands.length && hands[active].done) {
    active++;
    const next = hands[active];
    if (next && next.cards.length === 1) {
      let card: Card;
      [card, state] = drawCard(state);
      next.cards.push(card);
      if (next.cards[0].rank === "A" || handTotal(next.cards).total === 21) next.done = true;
    }
  }

  state = { ...state, hands, activeHand: Math.min(active, hands.length - 1) };
  if (active < hands.length) return state;
  return settle(playDealer(revealHole(state)));
}

function revealHole(state: GameState): GameState {
  if (state.holeRevealed || state.dealer.length < 2) return state;
  return { ...state, holeRevealed: true, runningCount: state.runningCount + hiLoValue(state.dealer[1].rank) };
}

export function dealerShouldHit(cards: readonly Card[], hitsSoft17: boolean): boolean {
  const { total, soft } = handTotal(cards);
  return total < 17 || (total === 17 && soft && hitsSoft17);
}

function playDealer(prev: GameState): GameState {
  const live = prev.hands.some((h) => handTotal(h.cards).total <= 21);
  if (!live) return prev;
  let state = prev;
  const dealer = [...state.dealer];
  while (dealerShouldHit(dealer, state.rules.dealerHitsSoft17)) {
    let card: Card;
    [card, state] = drawCard(state);
    dealer.push(card);
  }
  return { ...state, dealer };
}

function settle(state: GameState): GameState {
  const dealerBJ = isBlackjack(state.dealer);
  const dealerTotal = handTotal(state.dealer).total;
  const naturalEligible = state.hands.length === 1;
  const stats = { ...state.stats, rounds: state.stats.rounds + 1 };
  let returned = 0;
  let staked = state.insurance;

  const hands = state.hands.map((hand): PlayerHand => {
    staked += hand.bet;
    const total = handTotal(hand.cards).total;
    let outcome: Outcome;
    let payout: number;
    if (total > 21) [outcome, payout] = ["bust", 0];
    else if (naturalEligible && !hand.fromSplit && isBlackjack(hand.cards))
      [outcome, payout] = dealerBJ ? ["push", hand.bet] : ["blackjack", hand.bet * (1 + state.rules.blackjackPayout)];
    else if (dealerBJ) [outcome, payout] = ["lose", 0];
    else if (dealerTotal > 21 || total > dealerTotal) [outcome, payout] = ["win", hand.bet * 2];
    else if (total === dealerTotal) [outcome, payout] = ["push", hand.bet];
    else [outcome, payout] = ["lose", 0];

    returned += payout;
    if (outcome === "win" || outcome === "blackjack") stats.wins++;
    else if (outcome === "push") stats.pushes++;
    else stats.losses++;
    if (outcome === "blackjack") stats.blackjacks++;
    return { ...hand, outcome, payout, done: true };
  });

  if (state.insurance > 0 && dealerBJ) returned += state.insurance * 3;
  const roundNet = returned - staked;
  stats.totalWagered += staked;
  stats.net += roundNet;

  return { ...state, hands, bankroll: state.bankroll + returned, roundNet, phase: "roundOver", stats };
}
