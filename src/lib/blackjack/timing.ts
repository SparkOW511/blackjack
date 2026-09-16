import type { StepKind } from "./game";

export type TableSpeed = "relaxed" | "realistic" | "fast" | "instant";

export const SPEED_OPTIONS: [TableSpeed, string][] = [
  ["relaxed", "Relaxed"],
  ["realistic", "Realistic"],
  ["fast", "Fast"],
  ["instant", "Instant"],
];

/** Milliseconds a real dealer takes for each action, at "realistic" speed. */
const BASE: Record<StepKind, number> = {
  dealCard: 420,
  aiAction: 900,
  revealHole: 550,
  dealerHit: 620,
  settle: 800,
};

const MULTIPLIER: Record<TableSpeed, number> = {
  relaxed: 1.6,
  realistic: 1,
  fast: 0.55,
  instant: 0,
};

/**
 * Delay before the next table event. Dealers and players aren't metronomes, so each delay
 * carries ±15% jitter — which is also what makes keeping the count feel real.
 */
export function stepDelay(step: StepKind, speed: TableSpeed, random: () => number = Math.random): number {
  const base = BASE[step] * MULTIPLIER[speed];
  if (base === 0) return 0;
  return Math.round(base * (0.85 + random() * 0.3));
}
