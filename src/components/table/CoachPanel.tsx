"use client";

import { useMemo } from "react";
import { playerEdge } from "@/lib/blackjack/count";
import {
  type GameState,
  currentTrueCount,
  dealerPeeked,
  legalMoves,
  recommendation,
  unseenComposition,
} from "@/lib/blackjack/game";
import {
  DEALER_OUTCOME_LABELS,
  actionEVs,
  bustProbabilityIfHit,
  dealerDistribution,
  nextCardOdds,
} from "@/lib/blackjack/odds";
import { baseHouseEdge } from "@/lib/blackjack/rules";
import { cardsRemaining } from "@/lib/blackjack/shoe";
import type { Move } from "@/lib/blackjack/strategy";
import { formatMoney, formatPercent, formatSigned } from "@/lib/storage";

export const MOVE_LABEL: Record<Move, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
};

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/8 bg-felt-900/70 p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-300">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Bar({ label, value, baseline, tone = "brass" }: { label: string; value: number; baseline?: number; tone?: "brass" | "win" | "loss" }) {
  const color = { brass: "bg-brass-400", win: "bg-win", loss: "bg-loss" }[tone];
  return (
    <div className="grid grid-cols-[4.5rem_1fr_3.25rem] items-center gap-2 text-xs">
      <span className="text-white/60">{label}</span>
      <span className="relative h-2 overflow-hidden rounded-full bg-white/8">
        <span className={`absolute inset-y-0 left-0 rounded-full ${color} transition-[width] duration-500`} style={{ width: `${Math.min(value, 1) * 100}%` }} />
        {baseline !== undefined && (
          <span className="absolute inset-y-[-2px] w-px bg-white/70" style={{ left: `${baseline * 100}%` }} title="Fresh-shoe baseline" />
        )}
      </span>
      <span className="text-right font-mono tabular text-cream">{formatPercent(value)}</span>
    </div>
  );
}

interface CoachPanelProps {
  game: GameState;
  showCount: boolean;
  showOdds: boolean;
  /** While a count quiz is pending, anything that would give the count away is hidden. */
  concealed: boolean;
  quizStats: { attempts: number; correct: number };
}

export function CoachPanel({ game, showCount, showOdds, concealed, quizStats }: CoachPanelProps) {
  const { rules, shoe, stats } = game;
  const tc = currentTrueCount(game);
  const remaining = cardsRemaining(shoe);
  const dealt = shoe.position / shoe.cards.length;
  const cut = shoe.cutIndex / shoe.cards.length;

  const odds = useMemo(() => {
    const comp = unseenComposition(game);
    const next = nextCardOdds(comp);
    const up = game.dealer[0];
    const hand = game.hands[game.activeHand];
    if (game.phase === "insurance" && up) {
      const pTen = comp[9] / comp.reduce((a, b) => a + b, 0);
      return { next, insuranceEV: 3 * pTen - 1, pTen, turn: null };
    }
    if (game.phase !== "playerTurn" || !up || !hand) return { next, insuranceEV: null, pTen: null, turn: null };
    const legal = legalMoves(game);
    const dealer = dealerDistribution(up, comp, rules.dealerHitsSoft17, dealerPeeked(game));
    const evs = actionEVs({
      cards: hand.cards,
      dealer,
      composition: comp,
      canDouble: legal.double,
      canSplit: legal.split,
      doubleAfterSplit: rules.doubleAfterSplit,
    });
    const ranked = (Object.entries(evs) as [Move, number | null][])
      .filter((e): e is [Move, number] => e[1] !== null)
      .sort((a, b) => b[1] - a[1]);
    return {
      next,
      insuranceEV: null,
      pTen: null,
      turn: { dealer, ranked, bust: bustProbabilityIfHit(hand.cards, comp), rec: recommendation(game) },
    };
  }, [game, rules]);

  const edge = playerEdge(baseHouseEdge(rules), tc);
  const hideCount = concealed || !showCount;
  const accuracy = (n: number, d: number) => (d ? formatPercent(n / d, 0) : "—");

  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="The count"
        aside={<span className="font-mono text-[11px] text-white/40">Shoe #{shoe.shuffleNumber}</span>}
      >
        <div className={`grid grid-cols-3 gap-2 text-center transition ${hideCount ? "select-none blur-md" : ""}`} aria-hidden={hideCount}>
          <Stat label="Running" value={formatSigned(game.runningCount, 0)} tone={game.runningCount} />
          <Stat label="True" value={formatSigned(tc, 1)} tone={tc} highlight />
          <Stat label="Decks left" value={(remaining / 52).toFixed(1)} />
        </div>
        {hideCount && (
          <p className="mt-2 text-center text-xs text-white/50">
            {concealed ? "Hidden until you answer the count check." : "Count hidden — keep it in your head. (Settings)"}
          </p>
        )}
        <div className="mt-4">
          <div className="relative h-3 overflow-hidden rounded-full bg-white/8" aria-label="Shoe penetration">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-brass-600 to-brass-400 transition-[width] duration-500" style={{ width: `${dealt * 100}%` }} />
            <div className="absolute inset-y-0 w-1 bg-suit-red" style={{ left: `${cut * 100}%` }} title="Cut card" />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[11px] text-white/45">
            <span>{shoe.position} dealt</span>
            <span className="text-suit-red/90">cut @ {Math.round(cut * 100)}%</span>
            <span>{remaining} left</span>
          </div>
        </div>
      </Panel>

      {showOdds && (
        <Panel title="Live odds" aside={<span className="text-[11px] text-white/40">from unseen cards</span>}>
          <div className={`flex flex-col gap-4 transition ${concealed ? "select-none blur-md" : ""}`} aria-hidden={concealed}>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-white/70">Your edge now</span>
              <span className={`font-mono text-lg font-semibold tabular ${edge >= 0 ? "text-win" : "text-loss"}`}>
                {formatPercent(edge, 2, true)}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-wider text-white/40">Next card</span>
              <Bar label="10 / J Q K" value={odds.next.ten} baseline={16 / 52} />
              <Bar label="Ace" value={odds.next.ace} baseline={4 / 52} />
              <Bar label="2 – 6" value={odds.next.low} baseline={20 / 52} />
              <Bar label="7 – 9" value={odds.next.neutral} baseline={12 / 52} />
            </div>

            {odds.insuranceEV !== null && (
              <div className="rounded-xl bg-white/5 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Hole card is a ten</span>
                  <span className="font-mono">{formatPercent(odds.pTen!)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Insurance EV</span>
                  <span className={`font-mono font-semibold ${odds.insuranceEV >= 0 ? "text-win" : "text-loss"}`}>
                    {formatPercent(odds.insuranceEV, 1, true)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/45">Insurance is +EV only when more than ⅓ of unseen cards are tens.</p>
              </div>
            )}

            {odds.turn && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-white/40">Dealer finishes with</span>
                  {odds.turn.dealer.map((p, i) => (
                    <Bar key={i} label={DEALER_OUTCOME_LABELS[i]} value={p} tone={i === 5 ? "win" : "brass"} />
                  ))}
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-white/70">Bust if you hit</span>
                  <span className="font-mono font-semibold text-loss">{formatPercent(odds.turn.bust)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wider text-white/40">Expected value per $1 bet</span>
                  {odds.turn.ranked.map(([move, ev], i) => (
                    <div
                      key={move}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${i === 0 ? "bg-win/10 ring-1 ring-win/30" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        {MOVE_LABEL[move]}
                        {odds.turn!.rec?.move === move && (
                          <span className="rounded bg-brass-400/20 px-1.5 text-[10px] font-semibold uppercase text-brass-300">
                            {odds.turn!.rec.deviation ? "index play" : "chart"}
                          </span>
                        )}
                      </span>
                      <span className={`font-mono tabular ${ev >= 0 ? "text-win" : "text-loss"}`}>{formatSigned(ev, 3)}</span>
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] leading-snug text-white/40">
                    Split EV ignores resplits. Strategy charts are built for the whole shoe, so EV and chart can disagree on
                    close calls.
                  </p>
                </div>
              </>
            )}
          </div>
        </Panel>
      )}

      <Panel title="Session">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Row term="Rounds" value={String(stats.rounds)} />
          <Row term="W / L / P" value={`${stats.wins} / ${stats.losses} / ${stats.pushes}`} />
          <Row term="Net" value={formatMoney(stats.net, true)} tone={stats.net} />
          <Row term="Result vs action" value={stats.totalWagered ? formatPercent(stats.net / stats.totalWagered, 2, true) : "—"} />
          <Row term="Strategy" value={`${accuracy(stats.correctDecisions, stats.decisions)} of ${stats.decisions}`} />
          <Row term="Index plays" value={`${accuracy(stats.deviationsCorrect, stats.deviationSpots)} of ${stats.deviationSpots}`} />
          <Row term="Count checks" value={`${accuracy(quizStats.correct, quizStats.attempts)} of ${quizStats.attempts}`} />
          <Row term="House edge" value={formatPercent(baseHouseEdge(rules), 2)} />
        </dl>
      </Panel>
    </div>
  );
}

function Stat({ label, value, tone, highlight }: { label: string; value: string; tone?: number; highlight?: boolean }) {
  const color = tone === undefined ? "text-cream" : tone > 0 ? "text-win" : tone < 0 ? "text-loss" : "text-cream";
  return (
    <div className={`rounded-xl py-2 ${highlight ? "bg-brass-400/10 ring-1 ring-brass-400/30" : "bg-white/5"}`}>
      <div className="text-[10px] uppercase tracking-widest text-white/45">{label}</div>
      <div className={`font-mono text-2xl font-semibold tabular ${color}`}>{value}</div>
    </div>
  );
}

function Row({ term, value, tone }: { term: string; value: string; tone?: number }) {
  const color = tone === undefined || tone === 0 ? "text-cream" : tone > 0 ? "text-win" : "text-loss";
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-white/45">{term}</dt>
      <dd className={`font-mono tabular ${color}`}>{value}</dd>
    </div>
  );
}
