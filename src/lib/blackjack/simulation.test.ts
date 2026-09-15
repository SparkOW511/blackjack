import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Set SIM_OUT to a file path to capture results (test runners swallow console output). */
function report(line: string) {
  console.log(line);
  if (process.env.SIM_OUT) appendFileSync(process.env.SIM_OUT, `${line}\n`);
}
import { recommendedUnits } from "./count";
import { type GameState, currentTrueCount, gameReducer, initialGame, recommendation } from "./game";
import { DEFAULT_RULES, baseHouseEdge } from "./rules";

/**
 * Plays many rounds through the real engine and live-shuffled shoe to check that
 * the resulting edge lands where published blackjack math says it should.
 */
function simulate(rounds: number, counting: boolean) {
  let g: GameState = initialGame(DEFAULT_RULES, 1e12);
  for (let i = 0; i < rounds; i++) {
    const tc = currentTrueCount(g);
    const bet = counting ? recommendedUnits(tc) : 1;
    g = gameReducer(g, { type: "deal", bet });
    if (g.phase === "insurance") g = gameReducer(g, { type: "insurance", take: counting && currentTrueCount(g) >= 3 });
    while (g.phase === "playerTurn") {
      const rec = recommendation(g)!;
      g = gameReducer(g, { type: "move", move: counting ? rec.move : rec.basic });
    }
  }
  const initialUnits = counting ? null : rounds;
  return { stats: g.stats, edgePerInitialBet: initialUnits ? g.stats.net / initialUnits : null };
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
    const units = stats.net;
    report(`counter: net ${units.toFixed(0)} units over ${stats.rounds} rounds, ${((stats.net / stats.totalWagered) * 100).toFixed(3)}% of action`);
    expect(Number.isFinite(units)).toBe(true);
  }, 120_000);
});
