import { PlayingCard } from "@/components/PlayingCard";
import { type Card, cardValue, handTotal, isBlackjack } from "@/lib/blackjack/cards";
import type { Outcome, PlayerHand } from "@/lib/blackjack/game";
import { formatMoney } from "@/lib/storage";

const OUTCOME_STYLE: Record<Outcome, { label: string; className: string }> = {
  blackjack: { label: "Blackjack", className: "bg-brass-400 text-felt-950" },
  win: { label: "Win", className: "bg-win text-felt-950" },
  push: { label: "Push", className: "bg-white/80 text-felt-950" },
  lose: { label: "Lose", className: "bg-loss text-felt-950" },
  bust: { label: "Bust", className: "bg-loss text-felt-950" },
};

function TotalPill({ cards, hideHole }: { cards: readonly Card[]; hideHole?: boolean }) {
  if (cards.length === 0) return null;
  const shown = hideHole ? cards.slice(0, 1) : cards;
  const { total, soft } = handTotal(shown);
  const label = !hideHole && isBlackjack(cards) ? "BJ" : soft && total < 21 ? `${total - 10}/${total}` : String(total);
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular ring-1 ${
        total > 21 ? "bg-loss/20 text-loss ring-loss/40" : "bg-felt-950/70 text-cream ring-white/15"
      }`}
    >
      {hideHole ? `${cardValue(cards[0].rank) === 1 ? "A" : total}` : label}
    </span>
  );
}

export function DealerHand({
  cards,
  holeRevealed,
  showTags,
}: {
  cards: readonly Card[];
  holeRevealed: boolean;
  showTags: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/50">
        Dealer <TotalPill cards={cards} hideHole={!holeRevealed} />
      </div>
      <div className="flex min-h-[5.25rem] sm:min-h-[6.3rem]">
        {cards.map((card, i) => {
          const hidden = i === 1 && !holeRevealed;
          return (
            <div key={hidden ? `hole-${card.id}` : card.id} className={i > 0 ? "-ml-8 sm:-ml-10" : ""}>
              <PlayingCard
                card={card}
                faceDown={hidden}
                index={i < 2 ? i * 2 + 1 : 0}
                animate={i === 1 && holeRevealed ? "flip" : "deal"}
                showTag={showTags && !hidden}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlayerHands({
  hands,
  activeHand,
  isPlayerTurn,
  showTags,
}: {
  hands: readonly PlayerHand[];
  activeHand: number;
  isPlayerTurn: boolean;
  showTags: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-4">
      {hands.map((hand, h) => {
        const active = isPlayerTurn && h === activeHand && hands.length > 1;
        const outcome = hand.outcome ? OUTCOME_STYLE[hand.outcome] : null;
        return (
          <div
            key={h}
            className={`relative flex flex-col items-center gap-3 rounded-2xl px-3 pb-2 pt-4 transition ${
              active ? "bg-brass-400/10 ring-2 ring-brass-400/70" : ""
            } ${isPlayerTurn && hands.length > 1 && h !== activeHand && !hand.done ? "opacity-60" : ""}`}
          >
            {outcome && (
              <span
                className={`animate-pop absolute -top-3 z-10 rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider shadow-lg ${outcome.className}`}
              >
                {outcome.label}
              </span>
            )}
            <div className="flex min-h-[5.25rem] sm:min-h-[6.3rem]">
              {hand.cards.map((card, i) => (
                <div key={card.id} className={i > 0 ? "-ml-8 sm:-ml-10" : ""}>
                  <PlayingCard card={card} index={hands.length === 1 && i < 2 ? i * 2 : 0} showTag={showTags} />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <TotalPill cards={hand.cards} />
              <span className="rounded-full bg-brass-400/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-brass-200 ring-1 ring-brass-400/30">
                {formatMoney(hand.bet)}
                {hand.doubled ? " ×2" : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
