import { type Card, cardValue, handTotal, isBlackjack, valueIndex } from "./cards";
import { hiLoValue, trueCount } from "./count";
import { type Rules, DEFAULT_RULES } from "./rules";
import { type AiProfile, type AiSeatConfig, aiDecision } from "./seats";
import {
  type RandomInt,
  type Shoe,
  cardsRemaining,
  cryptoRandomInt,
  draw,
  needsShuffle,
  newShoe,
  undealtComposition,
} from "./shoe";
import { type Move, type Recommendation, INSURANCE_INDEX, describeHand, recommend } from "./strategy";

export type Phase = "betting" | "dealing" | "insurance" | "seatTurn" | "dealerTurn" | "roundOver";
export type Outcome = "win" | "lose" | "push" | "blackjack" | "bust";

/** One atomic thing the table does. The UI puts a delay in front of each. */
export type StepKind = "dealCard" | "aiAction" | "revealHole" | "dealerHit" | "settle";

export interface PlayerHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  fromSplit: boolean;
  outcome?: Outcome;
  /** Amount returned at settlement, stake included. */
  payout?: number;
}

export interface Seat {
  id: string;
  name: string;
  /** null for your seat. */
  profile: AiProfile | null;
  hands: PlayerHand[];
  activeHand: number;
}

interface DealTarget {
  seat: number | "dealer";
  faceDown?: boolean;
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
  /** AI seats first, your seat last: they act before you, so you sit at third base. */
  seats: Seat[];
  youIndex: number;
  activeSeat: number;
  dealer: Card[];
  holeRevealed: boolean;
  /** Hi-Lo count of every card you have seen since the shuffle. */
  runningCount: number;
  insurance: number;
  lastBet: number;
  /** True for the round dealt immediately after a shuffle. */
  shuffledThisRound: boolean;
  roundNet: number;
  feedback: DecisionFeedback[];
  stats: Stats;
  /** Remaining cards of the opening deal. */
  dealQueue: DealTarget[];
}

export type GameAction =
  | { type: "deal"; bet: number; ai?: AiSeatConfig[] }
  | { type: "tick" }
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
    seats: [],
    youIndex: 0,
    activeSeat: 0,
    dealer: [],
    holeRevealed: false,
    runningCount: 0,
    insurance: 0,
    lastBet: 10,
    shuffledThisRound: true,
    roundNet: 0,
    feedback: [],
    stats,
    dealQueue: [],
  };
}

// ---------- derived values ----------

export function currentTrueCount(state: GameState): number {
  return trueCount(state.runningCount, cardsRemaining(state.shoe));
}

/** Cards you cannot see: the undealt shoe, burn cards, and the dealer's hole card. */
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

export function yourSeat(state: GameState): Seat | undefined {
  return state.seats[state.youIndex];
}

export function isYourTurn(state: GameState): boolean {
  return state.phase === "seatTurn" && state.activeSeat === state.youIndex;
}

export interface LegalMoves {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
}

const NO_MOVES: LegalMoves = { hit: false, stand: false, double: false, split: false };

function seatLegalMoves(state: GameState, seatIndex: number, checkBankroll: boolean): LegalMoves {
  const seat = state.seats[seatIndex];
  const hand = seat?.hands[seat.activeHand];
  if (!hand || hand.done) return NO_MOVES;
  const twoCards = hand.cards.length === 2;
  const affordable = !checkBankroll || state.bankroll >= hand.bet;
  return {
    hit: true,
    stand: true,
    double: twoCards && affordable && (!hand.fromSplit || state.rules.doubleAfterSplit),
    split:
      twoCards &&
      affordable &&
      seat.hands.length < state.rules.maxHands &&
      cardValue(hand.cards[0].rank) === cardValue(hand.cards[1].rank),
  };
}

export function legalMoves(state: GameState): LegalMoves {
  if (!isYourTurn(state)) return NO_MOVES;
  return seatLegalMoves(state, state.youIndex, true);
}

export function recommendation(state: GameState): Recommendation | null {
  const seat = yourSeat(state);
  const hand = seat?.hands[seat.activeHand];
  const up = dealerUpcard(state);
  if (!isYourTurn(state) || !hand || !up) return null;
  const legal = legalMoves(state);
  return recommend(
    { cards: hand.cards, dealerUp: up, canDouble: legal.double, canSplit: legal.split },
    state.rules,
    currentTrueCount(state),
  );
}

export function dealerShouldHit(cards: readonly Card[], hitsSoft17: boolean): boolean {
  const { total, soft } = handTotal(cards);
  return total < 17 || (total === 17 && soft && hitsSoft17);
}

/**
 * The dealer only draws when a hand can still beat them: naturals are already paid and busts are
 * already collected. The hole card is still turned over at the end of every round, so every card
 * that leaves the shoe is one the counter has seen.
 */
function dealerMustPlay(state: GameState): boolean {
  return state.seats.some((seat) =>
    seat.hands.some(
      (hand) =>
        handTotal(hand.cards).total <= 21 &&
        !(seat.hands.length === 1 && !hand.fromSplit && isBlackjack(hand.cards)),
    ),
  );
}

/** What the table does next, or null when it is waiting for you. */
export function pendingStep(state: GameState): StepKind | null {
  switch (state.phase) {
    case "dealing":
      return "dealCard";
    case "seatTurn":
      return isYourTurn(state) ? null : "aiAction";
    case "dealerTurn":
      if (!state.holeRevealed) return "revealHole";
      if (dealerMustPlay(state) && dealerShouldHit(state.dealer, state.rules.dealerHitsSoft17)) return "dealerHit";
      return "settle";
    default:
      return null;
  }
}

/** Runs the table forward until it needs your input or the round ends. */
export function advanceUntilInput(state: GameState, maxSteps = 500): GameState {
  let next = state;
  for (let i = 0; i < maxSteps && pendingStep(next); i++) next = stepRound(next);
  return next;
}

// ---------- reducer ----------

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "deal":
      return deal(state, action.bet, action.ai ?? []);
    case "tick":
      return stepRound(state);
    case "insurance":
      return resolveInsurance(state, action.take);
    case "move":
      return applyYourMove(state, action.move);
    case "shuffle":
      if (!betweenRounds(state)) return state;
      return reshuffle(state);
    case "setRules":
      if (!betweenRounds(state)) return state;
      return { ...initialGame(action.rules, state.bankroll, state.stats), lastBet: state.lastBet };
    case "setBankroll":
      if (!betweenRounds(state)) return state;
      return { ...state, bankroll: action.bankroll };
    case "resetSession":
      if (!betweenRounds(state)) return state;
      return initialGame(state.rules, action.bankroll, EMPTY_STATS);
  }
}

function betweenRounds(state: GameState): boolean {
  return state.phase === "betting" || state.phase === "roundOver";
}

function reshuffle(state: GameState): GameState {
  return {
    ...state,
    shoe: newShoe(state.rules.decks, state.rules.penetration, state.shoe.shuffleNumber + 1),
    runningCount: 0,
    shuffledThisRound: true,
    seats: [],
    dealer: [],
    holeRevealed: false,
    dealQueue: [],
    phase: "betting",
  };
}

/** Draws a card; `visible` cards are added to the running count as they land. */
function drawCard(state: GameState, visible = true): [Card, GameState] {
  const [card, shoe] = draw(state.shoe);
  return [card, { ...state, shoe, runningCount: state.runningCount + (visible ? hiLoValue(card.rank) : 0) }];
}

function cloneSeats(seats: readonly Seat[]): Seat[] {
  return seats.map((seat) => ({ ...seat, hands: seat.hands.map((hand) => ({ ...hand, cards: [...hand.cards] })) }));
}

function newSeat(id: string, name: string, profile: AiProfile | null, bet: number): Seat {
  return {
    id,
    name,
    profile,
    hands: [{ cards: [], bet, doubled: false, done: false, fromSplit: false }],
    activeHand: 0,
  };
}

function deal(prev: GameState, bet: number, ai: AiSeatConfig[]): GameState {
  if (!betweenRounds(prev)) return prev;
  if (!(bet > 0) || bet > prev.bankroll) return prev;

  const start: GameState = needsShuffle(prev.shoe) ? reshuffle(prev) : { ...prev, shuffledThisRound: false };
  const seats = [...ai.map((cfg) => newSeat(cfg.id, cfg.name, cfg.profile, cfg.bet)), newSeat("you", "You", null, bet)];

  // Casino order: one card to each seat, dealer upcard, second card around, hole card face-down.
  const dealQueue: DealTarget[] = [];
  for (const round of [0, 1]) {
    for (let i = 0; i < seats.length; i++) dealQueue.push({ seat: i });
    dealQueue.push({ seat: "dealer", faceDown: round === 1 });
  }

  return {
    ...start,
    bankroll: start.bankroll - bet,
    lastBet: bet,
    seats,
    youIndex: seats.length - 1,
    activeSeat: 0,
    dealer: [],
    holeRevealed: false,
    insurance: 0,
    roundNet: 0,
    feedback: [],
    phase: "dealing",
    dealQueue,
  };
}

export function stepRound(state: GameState): GameState {
  switch (pendingStep(state)) {
    case "dealCard":
      return dealNextCard(state);
    case "aiAction":
      return playAiSeat(state);
    case "revealHole":
      return revealHole(state);
    case "dealerHit": {
      const [card, next] = drawCard(state);
      return { ...next, dealer: [...next.dealer, card] };
    }
    case "settle":
      return settle(state);
    default:
      return state;
  }
}

function dealNextCard(prev: GameState): GameState {
  const [target, ...rest] = prev.dealQueue;
  if (!target) return prev;
  const [card, drawn] = drawCard(prev, !target.faceDown);
  let state: GameState = { ...drawn, dealQueue: rest };

  if (target.seat === "dealer") {
    state = { ...state, dealer: [...state.dealer, card] };
  } else {
    const seats = cloneSeats(state.seats);
    seats[target.seat].hands[0].cards.push(card);
    state = { ...state, seats };
  }

  if (rest.length > 0) return state;
  return openingComplete(state);
}

function openingComplete(state: GameState): GameState {
  if (state.dealer[0]?.rank === "A") return { ...state, phase: "insurance" };
  return peekAndStart(state);
}

/** Two-card 21s stand pat — nobody acts on a natural. */
function markNaturals(state: GameState): GameState {
  const seats = cloneSeats(state.seats);
  for (const seat of seats) {
    for (const hand of seat.hands) if (isBlackjack(hand.cards)) hand.done = true;
  }
  return { ...state, seats };
}

function finishAllHands(state: GameState): GameState {
  const seats = cloneSeats(state.seats);
  for (const seat of seats) for (const hand of seat.hands) hand.done = true;
  return { ...state, seats };
}

function peekAndStart(prev: GameState): GameState {
  const state = markNaturals(prev);
  if (dealerPeeked(state) && isBlackjack(state.dealer)) {
    return settle(revealHole(finishAllHands(state)));
  }
  return advanceTable({ ...state, phase: "seatTurn", activeSeat: 0 });
}

function resolveInsurance(prev: GameState, take: boolean): GameState {
  if (prev.phase !== "insurance") return prev;
  const seat = yourSeat(prev);
  if (!seat) return prev;

  const tc = currentTrueCount(prev);
  const recommended = tc >= INSURANCE_INDEX ? "insurance" : "no insurance";
  const move = take ? "insurance" : "no insurance";
  const feedback: DecisionFeedback = {
    hand: `Insurance vs A (${describeHand(seat.hands[0].cards, prev.dealer[0]).split(" vs")[0]})`,
    move,
    recommended,
    basic: "no insurance",
    deviationNote: recommended === "insurance" ? "Take insurance at a true count of +3 or higher." : null,
    correct: move === recommended,
    trueCount: tc,
  };
  const amount = take ? Math.min(seat.hands[0].bet / 2, prev.bankroll) : 0;

  return peekAndStart({
    ...prev,
    insurance: amount,
    bankroll: prev.bankroll - amount,
    feedback: [...prev.feedback, feedback],
    stats: recordDecision(prev.stats, feedback),
  });
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

function applyYourMove(prev: GameState, move: Move): GameState {
  if (!legalMoves(prev)[move]) return prev;
  const rec = recommendation(prev);
  const seat = yourSeat(prev);
  if (!rec || !seat) return prev;

  const feedback: DecisionFeedback = {
    hand: describeHand(seat.hands[seat.activeHand].cards, prev.dealer[0]),
    move,
    recommended: rec.move,
    basic: rec.basic,
    deviationNote: rec.deviation?.note ?? null,
    correct: move === rec.move,
    trueCount: currentTrueCount(prev),
  };

  const graded: GameState = {
    ...prev,
    feedback: [...prev.feedback, feedback],
    stats: recordDecision(prev.stats, feedback),
  };
  return advanceTable(applyAction(graded, prev.youIndex, move, true));
}

function playAiSeat(prev: GameState): GameState {
  const seat = prev.seats[prev.activeSeat];
  const hand = seat?.hands[seat.activeHand];
  const up = dealerUpcard(prev);
  if (!seat?.profile || !hand || !up) return prev;

  const legal = seatLegalMoves(prev, prev.activeSeat, false);
  const move = aiDecision(seat.profile, {
    cards: hand.cards,
    dealerUp: up,
    canDouble: legal.double,
    canSplit: legal.split,
    rules: prev.rules,
  });
  // A profile should never pick an illegal move, but never trust it with the bankroll-free path.
  return advanceTable(applyAction(prev, prev.activeSeat, legal[move] ? move : "stand", false));
}

/** Applies one move to a seat's active hand. Only your seat's money moves the bankroll. */
function applyAction(prev: GameState, seatIndex: number, move: Move, charge: boolean): GameState {
  let state = prev;
  const seats = cloneSeats(prev.seats);
  const seat = seats[seatIndex];
  const hand = seat.hands[seat.activeHand];
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
      if (charge) state = { ...state, bankroll: state.bankroll - hand.bet };
      hand.bet *= 2;
      hand.doubled = true;
      [card, state] = drawCard(state);
      hand.cards.push(card);
      hand.done = true;
      break;
    case "split": {
      if (charge) state = { ...state, bankroll: state.bankroll - hand.bet };
      const second: PlayerHand = { ...hand, cards: [hand.cards[1]], fromSplit: true, done: false };
      hand.cards = [hand.cards[0]];
      hand.fromSplit = true;
      seat.hands.splice(seat.activeHand + 1, 0, second);
      [card, state] = drawCard(state);
      hand.cards.push(card);
      if (hand.cards[0].rank === "A" || handTotal(hand.cards).total === 21) hand.done = true;
      break;
    }
  }

  return { ...state, seats };
}

/**
 * Finds the next hand that still needs a decision, dealing split hands their second card on the
 * way. Falls through to the dealer once every seat is finished.
 */
function advanceTable(prev: GameState): GameState {
  let state = prev;
  const seats = cloneSeats(prev.seats);
  let seatIndex = prev.activeSeat;

  for (;;) {
    const seat = seats[seatIndex];
    if (!seat) break;

    let handIndex = seat.activeHand;
    while (handIndex < seat.hands.length && seat.hands[handIndex].done) handIndex++;

    if (handIndex < seat.hands.length) {
      const hand = seat.hands[handIndex];
      if (hand.cards.length === 1) {
        // Second card for a hand created by a split.
        let card: Card;
        [card, state] = drawCard(state);
        hand.cards.push(card);
        if (hand.cards[0].rank === "A" || handTotal(hand.cards).total === 21) {
          hand.done = true;
          continue;
        }
      }
      seat.activeHand = handIndex;
      return { ...state, seats, activeSeat: seatIndex };
    }

    seatIndex++;
    if (seatIndex >= seats.length) {
      return { ...state, seats, activeSeat: prev.youIndex, phase: "dealerTurn" };
    }
  }

  return { ...state, seats, phase: "dealerTurn" };
}

function revealHole(state: GameState): GameState {
  if (state.holeRevealed || state.dealer.length < 2) return state;
  return { ...state, holeRevealed: true, runningCount: state.runningCount + hiLoValue(state.dealer[1].rank) };
}

function settle(state: GameState): GameState {
  const dealerBJ = isBlackjack(state.dealer);
  const dealerTotal = handTotal(state.dealer).total;
  const stats = { ...state.stats, rounds: state.stats.rounds + 1 };
  let returned = 0;
  let staked = state.insurance;

  const seats = state.seats.map((seat, seatIndex): Seat => {
    const isYou = seatIndex === state.youIndex;
    const naturalEligible = seat.hands.length === 1;

    const hands = seat.hands.map((hand): PlayerHand => {
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

      if (isYou) {
        staked += hand.bet;
        returned += payout;
        if (outcome === "win" || outcome === "blackjack") stats.wins++;
        else if (outcome === "push") stats.pushes++;
        else stats.losses++;
        if (outcome === "blackjack") stats.blackjacks++;
      }
      return { ...hand, outcome, payout, done: true };
    });

    return { ...seat, hands };
  });

  if (state.insurance > 0 && dealerBJ) returned += state.insurance * 3;
  const roundNet = returned - staked;
  stats.totalWagered += staked;
  stats.net += roundNet;

  return { ...state, seats, bankroll: state.bankroll + returned, roundNet, phase: "roundOver", stats };
}
