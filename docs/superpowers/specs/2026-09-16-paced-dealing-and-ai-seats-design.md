# Paced dealing and AI seats

**Date:** 2026-09-16
**Status:** approved

## Problem

The table deals a whole round instantly. One `deal` action produces all four cards and the
player's hand resolves synchronously. Two consequences:

1. The running count jumps in a single frame, so there is no practice at keeping a count while
   cards arrive at casino speed.
2. There is only ever one player, so a round exposes 4–6 cards instead of the 15–20 a counter
   actually has to track at a busy table.

## Approach

Advance the round **one visible event at a time**. `stepRound(state)` performs exactly one atomic
table event — deal one card, flip the hole card, one AI decision, one dealer hit, settle — and
returns the new state. `pendingStep(state)` reports what would happen next, or `null` when the
table is waiting for the player. The UI schedules `dispatch({ type: "tick" })` on a timer.

The engine stays pure and synchronous: tests and the Monte Carlo simulation drive it with
`advanceUntilInput()`, which loops steps with no delays. Only the UI knows about milliseconds.

Alternatives rejected:

- **Animate in the UI over the instant engine.** Two sources of truth; the displayed count could
  disagree with the cards on the felt.
- **Timers inside the engine.** Impure and untestable; breaks the house-edge simulation.

## Design

### Seats

`GameState.hands` becomes `GameState.seats`. Each seat holds its own hands, active hand index and
bet. `youIndex` is always the last seat, so AI players sit to the player's right and act first —
the player is at third base and sees their cards before deciding.

```ts
interface Seat {
  id: string;
  name: string;
  profile: AiProfile | null; // null = you
  hands: PlayerHand[];
  activeHand: number;
}
```

### Round flow

`betting → dealing → insurance? → seatTurn → dealerTurn → roundOver`

`dealQueue` holds the opening deal in casino order: one card to each seat left to right, dealer
upcard, second card around, dealer hole card face-down. Each `dealCard` step pops one target.

When the deal completes: an ace up moves to `insurance` (which waits for the player); otherwise the
dealer peeks. Naturals are marked done immediately.

The dealer only *draws* when a hand can still beat them, but the hole card is turned over at the end
of every round. Leaving it face-down (as some casinos do when everyone busts) was measured to cost
the counter most of their edge, because roughly a fifth of rounds would remove a card from the shoe
that the count never saw.

### AI players

Four profiles, mixed randomly across seats, each with a name and a flat bet:

| Profile | Behaviour |
|---|---|
| `solid` | Correct basic strategy |
| `cautious` | Never busts a stiff — stands on hard 12+ |
| `chaser` | Hits every stiff, hits soft 18, doubles 9–11 |
| `mimic` | Plays like the dealer, hits to hard 17 |

AI seats are generated in the UI (names, profiles, bets) and passed into the `deal` action, keeping
the engine deterministic. Their money is cosmetic: only the player's seat touches bankroll, stats
and round net. AI seats never take insurance.

### Counting

Every face-up card updates the running count the moment it lands, so the count builds card by card.
`unseenComposition` is derived from the shoe, so the odds panel stays correct with any number of
seats. More seats means more cards per round and faster penetration.

### Settings

New "Table" section:

- **AI seats:** 0–4, default 0.
- **Table speed:** Relaxed / Realistic (default) / Fast / Instant. Instant reproduces today's
  behaviour for fast drilling.
- **Decision timer:** off by default; when on, a 15-second countdown stands the hand on expiry.

Delays live in `timing.ts` as a base duration per step kind times a speed multiplier, with ±15%
jitter so the dealer is not a metronome.

### Files

- `src/lib/blackjack/seats.ts` — seat config, AI profiles, `aiDecision`
- `src/lib/blackjack/timing.ts` — speeds and per-step delays
- `src/lib/blackjack/game.ts` — state machine (`stepRound`, `pendingStep`, `advanceUntilInput`)
- `src/components/table/SeatView.tsx` — renders one seat
- Updates: `BlackjackTable`, `CoachPanel`, `SettingsDialog`, `HandView`

## Testing

- Dealing order and card-by-card count updates.
- Each AI profile's decisions.
- Existing rigged-shoe tests, driven through `advanceUntilInput`.
- Monte Carlo at 0 seats: measured edge must stay near −0.65%.
- **Invariant:** the same simulation with 3 AI seats must produce the same player edge. Other
  players cannot change the player's expected value; if that moves, settlement is wrong.

## Risks

- Largest refactor so far; `game.ts` roughly doubles, hence the split into three modules.
- Saved sessions from the previous version must keep loading (unknown keys dropped, new settings
  defaulted).
