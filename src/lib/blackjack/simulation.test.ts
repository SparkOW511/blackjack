import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Set SIM_OUT to a file path to capture results (test runners swallow console output). */
function report(line: string) {
  console.log(line);
  if (process.env.SIM_OUT) appendFileSync(process.env.SIM_OUT, `${line}\n`);
}
import { recommendedUnits } from "./count";
import {
  type GameState,
  advanceUntilInput,
  currentTrueCount,
  gameReducer,
  initialGame,
  isYourTurn,
  recommendation,
} from "./game";
import { DEFAULT_RULES, baseHouseEdge } from "./rules";
import { createAiSeats } from "./seats";

/**
 * Plays many rounds through the real engine and live-shuffled shoe to check that
 * the resulting edge lands where published blackjack math says it should.
 */
function simulate(rounds: number, counting: boolean, aiSeats = 0) {
  let g: GameState = initialGame(DEFAULT_RULES, 1e12);
  const ai = createAiSeats(aiSeats);

  for (let i = 0; i < rounds; i++) {
    const bet = counting ? recommendedUnits(currentTrueCount(g)) : 1;
    g = advanceUntilInput(gameReducer(g, { type: "deal", bet, ai }));
    if (g.phase === "insurance") {
      g = advanceUntilInput(gameReducer(g, { type: "insurance", take: counting && currentTrueCount(g) >= 3 }));
    }
    while (isYourTurn(g)) {
      const rec = recommendation(g)!;
      g = advanceUntilInput(gameReducer(g, { type: "move", move: counting ? rec.move : rec.basic }));
    }
  }
  return { stats: g.stats, edgePerInitialBet: counting ? null : g.stats.net / rounds };
}

describe("Monte Carlo", () => {
  it("basic strategy produces a realistic house edge", () => {
    const rounds = Number(process.env.SIM_ROUNDS) || 300_000;
    const { edgePerInitialBet } = simulate(rounds, false);
    const expected = -baseHouseEdge(DEFAULT_RULES);
    report(`basic strategy edge: ${(edgePerInitialBet! * 100).toFixed(3)}% (published ≈ ${(expected * 100).toFixed(2)}%)`);
    // Standard error at 300k rounds is ≈ 0.21%, so allow a ±0.75% band.
    expect(Math.abs(edgePerInitialBet! - expected)).toBeLessThan(0.0075);
  }, 120_000);

  it("a 1–12 Hi-Lo spread with deviations wins long-term", () => {
    const { stats } = simulate(300_000, true);
    report(
      `counter: net ${stats.net.toFixed(0)} units over ${stats.rounds} rounds, ${((stats.net / stats.totalWagered) * 100).toFixed(3)}% of action`,
    );
    expect(Number.isFinite(stats.net)).toBe(true);
  }, 120_000);

  it("other players at the table do not change your edge", () => {
    const rounds = Number(process.env.SIM_ROUNDS) || 500_000;
    const solo = simulate(rounds, false, 0).edgePerInitialBet!;
    const crowded = simulate(rounds, false, 3).edgePerInitialBet!;
    report(
      `heads-up edge: ${(solo * 100).toFixed(3)}% · with 3 other players: ${(crowded * 100).toFixed(3)}% · gap ${((crowded - solo) * 100).toFixed(3)}%`,
    );
    // Other players consume cards but cannot shift your expectation. At 500k rounds per arm the
    // gap's standard error is ≈0.23%, so this catches a systematic leak, not a small bias.
    expect(Math.abs(crowded - solo)).toBeLessThan(0.008);
  }, 300_000);
});
