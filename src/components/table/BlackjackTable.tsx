"use client";

import { useEffect, useReducer, useState } from "react";
import { recommendedUnits } from "@/lib/blackjack/count";
import {
  type DecisionFeedback,
  EMPTY_STATS,
  type Stats,
  currentTrueCount,
  gameReducer,
  initialGame,
  isYourTurn,
  legalMoves,
  pendingStep,
  recommendation,
  yourSeat,
} from "@/lib/blackjack/game";
import { DEFAULT_RULES, type Rules, describeRules } from "@/lib/blackjack/rules";
import { type AiSeatConfig, createAiSeats } from "@/lib/blackjack/seats";
import { needsShuffle } from "@/lib/blackjack/shoe";
import { INSURANCE_INDEX, type Move } from "@/lib/blackjack/strategy";
import { stepDelay } from "@/lib/blackjack/timing";
import { formatMoney, formatSigned, loadJSON, saveJSON } from "@/lib/storage";
import { CoachPanel, MOVE_LABEL } from "./CoachPanel";
import { DealerHand } from "./HandView";
import { SeatView } from "./SeatView";
import { DEFAULT_SETTINGS, SettingsDialog, type TrainerSettings } from "./SettingsDialog";

const STORAGE_KEY = "true-count:table:v1";
const STARTING_BANKROLL = 1000;

const CHIPS = [
  { value: 5, className: "bg-[#b3243a] ring-[#f4c1c9]" },
  { value: 25, className: "bg-[#1f7a4f] ring-[#bfeccf]" },
  { value: 100, className: "bg-[#1b1b1f] ring-[#d6d6dc]" },
  { value: 500, className: "bg-[#5b2a86] ring-[#dcc6f2]" },
] as const;

const MOVES: { move: Move; key: string }[] = [
  { move: "hit", key: "H" },
  { move: "stand", key: "S" },
  { move: "double", key: "D" },
  { move: "split", key: "P" },
];

interface SaveData {
  rules: Rules;
  bankroll: number;
  stats: Stats;
  settings: TrainerSettings;
  quiz: { attempts: number; correct: number };
  lastBet: number;
}

const DEFAULT_SAVE: SaveData = {
  rules: DEFAULT_RULES,
  bankroll: STARTING_BANKROLL,
  stats: EMPTY_STATS,
  settings: DEFAULT_SETTINGS,
  quiz: { attempts: 0, correct: 0 },
  lastBet: 10,
};

/** Drops options from older saves that the table no longer supports (e.g. surrender). */
function sanitizeRules(saved: Partial<Rules>): Rules {
  const known = Object.entries(saved).filter(([key]) => key in DEFAULT_RULES);
  return { ...DEFAULT_RULES, ...Object.fromEntries(known) };
}

function feedbackLabel(move: DecisionFeedback["move"]): string {
  if (move === "insurance") return "Take insurance";
  if (move === "no insurance") return "Decline insurance";
  return MOVE_LABEL[move];
}

export default function BlackjackTable() {
  const [saved] = useState(() => loadJSON(STORAGE_KEY, DEFAULT_SAVE));
  const [game, dispatch] = useReducer(gameReducer, saved, (s) => ({
    ...initialGame(sanitizeRules(s.rules), s.bankroll, { ...EMPTY_STATS, ...s.stats }),
    lastBet: s.lastBet,
  }));
  const [settings, setSettings] = useState<TrainerSettings>({ ...DEFAULT_SETTINGS, ...saved.settings });
  const [aiPlayers, setAiPlayers] = useState<AiSeatConfig[]>(() =>
    createAiSeats({ ...DEFAULT_SETTINGS, ...saved.settings }.aiSeats),
  );
  const [quizStats, setQuizStats] = useState(saved.quiz);
  const [bet, setBet] = useState(saved.lastBet);
  const [answeredRound, setAnsweredRound] = useState(-1);
  const [quizResult, setQuizResult] = useState<{ guess: number; actual: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  const betweenRounds = game.phase === "betting" || game.phase === "roundOver";
  const yourTurn = isYourTurn(game);
  const step = pendingStep(game);
  const quizDue =
    settings.quizEvery > 0 &&
    game.phase === "roundOver" &&
    game.stats.rounds % settings.quizEvery === 0 &&
    answeredRound !== game.stats.rounds;
  const canDeal = betweenRounds && !quizDue && bet > 0 && bet <= game.bankroll;
  const legal = legalMoves(game);
  const rec = recommendation(game);
  const tc = currentTrueCount(game);
  const countVisible = settings.showCount && !quizDue;
  const lastFeedback = game.feedback.at(-1);
  const timerActive = yourTurn && settings.decisionSeconds > 0;

  // The table deals itself forward one card, one decision at a time.
  useEffect(() => {
    if (!step) return;
    const id = setTimeout(() => dispatch({ type: "tick" }), stepDelay(step, settings.speed));
    return () => clearTimeout(id);
  }, [step, game, settings.speed]);

  // Optional decision clock; it restarts for every decision you face.
  useEffect(() => {
    if (!timerActive) return;
    const deadline = Date.now() + settings.decisionSeconds * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(id);
        dispatch({ type: "move", move: "stand" });
      }
    }, 100);
    return () => clearInterval(id);
  }, [timerActive, settings.decisionSeconds, game]);

  useEffect(() => {
    if (!betweenRounds) return;
    saveJSON(STORAGE_KEY, {
      rules: game.rules,
      bankroll: game.bankroll,
      stats: game.stats,
      settings,
      quiz: quizStats,
      lastBet: game.lastBet,
    } satisfies SaveData);
  }, [betweenRounds, game.rules, game.bankroll, game.stats, game.lastBet, settings, quizStats]);

  const deal = () => {
    if (!canDeal) return;
    setQuizResult(null);
    dispatch({ type: "deal", bet, ai: aiPlayers });
  };

  const answerQuiz = (guess: number) => {
    const actual = game.runningCount;
    setQuizStats((q) => ({ attempts: q.attempts + 1, correct: q.correct + (guess === actual ? 1 : 0) }));
    setQuizResult({ guess, actual });
    setAnsweredRound(game.stats.rounds);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea, dialog")) return;
      const key = e.key.toLowerCase();
      if (yourTurn) {
        const found = MOVES.find((m) => m.key.toLowerCase() === key);
        if (found && legal[found.move]) {
          e.preventDefault();
          dispatch({ type: "move", move: found.move });
        }
      } else if (game.phase === "insurance") {
        if (key === "y" || key === "n") dispatch({ type: "insurance", take: key === "y" });
      } else if ((key === " " || key === "enter") && canDeal) {
        e.preventDefault();
        deal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const notice =
    game.phase === "roundOver" && needsShuffle(game.shoe)
      ? "Cut card is out — the shoe will be shuffled before the next hand"
      : game.shuffledThisRound && game.stats.rounds === 0
        ? "Fresh shoe: shuffled, cut and one card burned"
        : game.shuffledThisRound && game.phase !== "roundOver"
          ? "New shoe shuffled — running count resets to 0"
          : null;

  const status =
    game.phase === "dealing"
      ? "Dealing…"
      : game.phase === "seatTurn" && !yourTurn
        ? `${game.seats[game.activeSeat]?.name ?? "Player"} is playing…`
        : game.phase === "dealerTurn"
          ? "Dealer plays…"
          : null;

  const yourBet = yourSeat(game)?.hands[0].bet ?? bet;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs text-white/50">
          {describeRules(game.rules)}
          {settings.aiSeats > 0 && ` · ${settings.aiSeats + 1} players`}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/70">
            Bankroll <strong className="ml-1 font-mono text-brass-200 tabular">{formatMoney(game.bankroll)}</strong>
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:border-brass-400/50 hover:text-white"
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <section className="felt felt-noise relative flex min-h-120 flex-col justify-between gap-4 overflow-hidden rounded-4xl px-3 py-5 sm:min-h-144 sm:rounded-[3rem] sm:px-10 sm:py-8">
            <div className="flex min-h-7 justify-center">
              {notice && (
                <span key={notice} className="animate-pop rounded-full bg-felt-950/70 px-3 py-1 text-center text-xs text-brass-200 ring-1 ring-brass-400/30">
                  {notice}
                </span>
              )}
            </div>

            {game.dealer.length > 0 ? (
              <DealerHand cards={game.dealer} holeRevealed={game.holeRevealed} showTags={settings.showTags} />
            ) : (
              <div className="mx-auto h-21 w-32 rounded-xl border-2 border-dashed border-white/10 sm:h-[6.3rem]" />
            )}

            <div className="pointer-events-none flex min-h-16 flex-col items-center justify-center text-center">
              {game.phase === "roundOver" ? (
                <div key={game.stats.rounds} className="animate-pop">
                  <div
                    className={`font-display text-4xl font-semibold tabular sm:text-5xl ${
                      game.roundNet > 0 ? "text-win" : game.roundNet < 0 ? "text-loss" : "text-cream"
                    }`}
                  >
                    {game.roundNet === 0 ? "Push" : formatMoney(game.roundNet, true)}
                  </div>
                </div>
              ) : status ? (
                <span className="rounded-full bg-felt-950/50 px-4 py-1.5 text-sm text-brass-200/90">{status}</span>
              ) : (
                <div className="font-display text-brass-300/50">
                  <div className="text-sm tracking-[0.3em] sm:text-base">
                    BLACKJACK PAYS {game.rules.blackjackPayout === 1.5 ? "3 TO 2" : "6 TO 5"}
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.25em] sm:text-xs">
                    DEALER {game.rules.dealerHitsSoft17 ? "HITS" : "STANDS ON"} SOFT 17 · INSURANCE PAYS 2 TO 1
                  </div>
                </div>
              )}
            </div>

            {game.seats.length > 0 ? (
              <div className="flex flex-wrap items-end justify-center gap-1 sm:gap-3">
                {game.seats.map((seat, i) => (
                  <SeatView
                    key={seat.id}
                    seat={seat}
                    isYou={i === game.youIndex}
                    isActive={game.phase === "seatTurn" && game.activeSeat === i}
                    showTags={settings.showTags}
                  />
                ))}
              </div>
            ) : (
              <div className="mx-auto grid size-28 place-items-center rounded-full border-2 border-dashed border-brass-400/40 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/50">Bet</div>
                  <div className="font-mono text-xl font-semibold text-brass-200">{formatMoney(bet)}</div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-white/8 bg-felt-900/70 p-4 sm:p-5">
            {lastFeedback && (
              <div
                key={`${game.stats.decisions}-${game.feedback.length}`}
                className={`mb-4 rounded-2xl px-4 py-2.5 text-sm ${
                  lastFeedback.correct ? "bg-win/10 text-win ring-1 ring-win/25" : "animate-shake bg-loss/10 text-loss ring-1 ring-loss/30"
                }`}
              >
                <span className="font-semibold">{lastFeedback.correct ? "✓ Correct" : "✗ Mistake"}</span>
                <span className="text-white/80">
                  {" "}
                  · {lastFeedback.hand}:{" "}
                  {lastFeedback.correct
                    ? feedbackLabel(lastFeedback.move)
                    : `you chose ${feedbackLabel(lastFeedback.move)}, the right play is ${feedbackLabel(lastFeedback.recommended)}`}
                  {lastFeedback.deviationNote && (
                    <span className="text-brass-200">
                      {" "}
                      — index play at TC {formatSigned(lastFeedback.trueCount)}: {lastFeedback.deviationNote}
                    </span>
                  )}
                </span>
              </div>
            )}

            {yourTurn && (
              <div className="flex flex-col gap-3">
                {timerActive && (
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-brass-400 transition-[width] duration-100"
                        style={{ width: `${((remainingMs || settings.decisionSeconds * 1000) / (settings.decisionSeconds * 1000)) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-white/60 tabular">
                      {Math.ceil((remainingMs || settings.decisionSeconds * 1000) / 1000)}s
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MOVES.map(({ move, key }) => {
                    const coached = settings.coachBeforeActing && rec?.move === move;
                    return (
                      <button
                        key={move}
                        disabled={!legal[move]}
                        onClick={() => dispatch({ type: "move", move })}
                        className={`group flex items-center justify-between rounded-2xl px-4 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                          coached
                            ? "bg-brass-400 text-felt-950 shadow-lg shadow-brass-500/30 hover:bg-brass-300"
                            : "bg-white/8 text-cream hover:bg-white/15"
                        }`}
                      >
                        {MOVE_LABEL[move]}
                        <kbd className={`rounded px-1.5 font-mono text-[11px] ${coached ? "bg-felt-950/15" : "bg-black/30 text-white/50"}`}>{key}</kbd>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {game.phase === "insurance" && (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                <p className="text-sm text-white/80">
                  Dealer shows an ace. Insurance costs <strong>{formatMoney(yourBet / 2)}</strong> and pays 2 to 1.
                </p>
                <div className="flex gap-2">
                  {[true, false].map((take) => {
                    const coached = settings.coachBeforeActing && take === tc >= INSURANCE_INDEX;
                    return (
                      <button
                        key={String(take)}
                        onClick={() => dispatch({ type: "insurance", take })}
                        className={`rounded-2xl px-4 py-2.5 font-semibold transition ${
                          coached ? "bg-brass-400 text-felt-950" : "bg-white/8 text-cream hover:bg-white/15"
                        }`}
                      >
                        {take ? "Take insurance" : "No insurance"}{" "}
                        <kbd className="ml-1 rounded bg-black/20 px-1.5 font-mono text-[11px]">{take ? "Y" : "N"}</kbd>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {!betweenRounds && !yourTurn && game.phase !== "insurance" && (
              <p className="py-2 text-center text-sm text-white/50">{status}</p>
            )}

            {betweenRounds && quizDue && <CountQuiz onSubmit={answerQuiz} />}

            {betweenRounds && !quizDue && (
              <div className="flex flex-col gap-4">
                {quizResult && (
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm ${
                      quizResult.guess === quizResult.actual ? "bg-win/10 text-win" : "bg-loss/10 text-loss"
                    }`}
                  >
                    {quizResult.guess === quizResult.actual
                      ? `✓ Spot on — the running count is ${formatSigned(quizResult.actual, 0)}.`
                      : `✗ You said ${formatSigned(quizResult.guess, 0)}; the running count is ${formatSigned(quizResult.actual, 0)}.`}
                  </div>
                )}

                {game.bankroll < CHIPS[0].value ? (
                  <div className="flex flex-col items-center gap-3 py-2 text-center">
                    <p className="text-white/70">You’re out of chips. Even perfect counters go broke without enough bankroll.</p>
                    <button
                      onClick={() => dispatch({ type: "setBankroll", bankroll: STARTING_BANKROLL })}
                      className="rounded-full bg-brass-400 px-5 py-2 font-semibold text-felt-950"
                    >
                      Rebuy {formatMoney(STARTING_BANKROLL)}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {CHIPS.map((chip) => (
                        <button
                          key={chip.value}
                          disabled={bet + chip.value > game.bankroll}
                          onClick={() => setBet((b) => b + chip.value)}
                          className={`grid size-12 place-items-center rounded-full font-mono text-sm font-bold text-white shadow-lg ring-4 ring-inset transition hover:-translate-y-0.5 disabled:opacity-30 ${chip.className}`}
                          aria-label={`Add ${chip.value} to bet`}
                        >
                          {chip.value}
                        </button>
                      ))}
                      <button onClick={() => setBet(0)} className="rounded-full px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
                        Clear
                      </button>
                      <button
                        disabled={bet * 2 > game.bankroll || bet === 0}
                        onClick={() => setBet((b) => b * 2)}
                        className="rounded-full px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-30"
                      >
                        ×2
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {countVisible && (
                        <button
                          onClick={() => setBet(Math.min(recommendedUnits(tc) * settings.unit, game.bankroll))}
                          className="rounded-full border border-brass-400/40 px-3 py-2 text-sm text-brass-200 transition hover:bg-brass-400/10"
                          title="Bet spread: 1 unit at TC ≤ +1, then 2, 4, 8 and 12 units"
                        >
                          Spread at TC {formatSigned(Math.trunc(tc), 0)}: {formatMoney(recommendedUnits(tc) * settings.unit)}
                        </button>
                      )}
                      <button
                        onClick={deal}
                        disabled={!canDeal}
                        className="flex items-center gap-3 rounded-full bg-brass-400 px-6 py-3 font-semibold text-felt-950 shadow-lg shadow-brass-500/20 transition hover:bg-brass-300 disabled:opacity-40"
                      >
                        Deal {formatMoney(bet)}
                        <kbd className="rounded bg-felt-950/15 px-1.5 font-mono text-[11px]">Space</kbd>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-18">
          <CoachPanel
            game={game}
            showCount={settings.showCount}
            showOdds={settings.showOdds}
            concealed={quizDue}
            quizStats={quizStats}
          />
        </aside>
      </div>

      {settingsOpen && (
        <SettingsDialog
          open
          onClose={() => setSettingsOpen(false)}
          rules={game.rules}
          settings={settings}
          canChangeRules={betweenRounds}
          onApply={(rules, next) => {
            if (betweenRounds && JSON.stringify(rules) !== JSON.stringify(game.rules)) dispatch({ type: "setRules", rules });
            if (next.aiSeats !== settings.aiSeats) setAiPlayers(createAiSeats(next.aiSeats));
            setSettings(next);
            setSettingsOpen(false);
          }}
          onResetSession={() => {
            dispatch({ type: "resetSession", bankroll: STARTING_BANKROLL });
            setQuizStats({ attempts: 0, correct: 0 });
            setBet(10);
            setSettingsOpen(false);
          }}
        />
      )}
    </main>
  );
}

function CountQuiz({ onSubmit }: { onSubmit: (guess: number) => void }) {
  const [value, setValue] = useState(0);
  return (
    <form
      className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <div>
        <p className="font-display text-lg font-semibold text-cream">Count check</p>
        <p className="text-sm text-white/60">What’s the running count right now?</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setValue((v) => v - 1)} className="size-11 rounded-full bg-white/8 text-xl hover:bg-white/15" aria-label="Decrease">
          −
        </button>
        <input
          type="number"
          value={value}
          autoFocus
          onChange={(e) => setValue(Number(e.target.value) || 0)}
          className="w-20 rounded-xl border border-white/10 bg-felt-950 px-3 py-2 text-center font-mono text-xl text-cream outline-none focus:border-brass-400"
          aria-label="Running count"
        />
        <button type="button" onClick={() => setValue((v) => v + 1)} className="size-11 rounded-full bg-white/8 text-xl hover:bg-white/15" aria-label="Increase">
          +
        </button>
        <button type="submit" className="ml-2 rounded-full bg-brass-400 px-5 py-2.5 font-semibold text-felt-950 hover:bg-brass-300">
          Check
        </button>
      </div>
    </form>
  );
}
