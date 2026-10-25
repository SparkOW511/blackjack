import { PlayingCard } from "@/components/PlayingCard";
import { type Card, cardValue, handTotal, isBlackjack } from "@/lib/blackjack/cards";
import type { Outcome } from "@/lib/blackjack/game";

export const OUTCOME_STYLE: Record<Outcome, { label: string; className: string }> = {
  blackjack: { label: "Blackjack", className: "bg-brass-400 text-felt-950" },
  win: { label: "Win", className: "bg-win text-felt-950" },
  push: { label: "Push", className: "bg-white/80 text-felt-950" },
  lose: { label: "Lose", className: "bg-loss text-felt-950" },
  bust: { label: "Bust", className: "bg-loss text-felt-950" },
};

export function TotalPill({ cards, hideHole }: { cards: readonly Card[]; hideHole?: boolean }) {
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
      <div className="flex min-h-21 sm:min-h-[6.3rem]">
        {cards.map((card, i) => {
          const hidden = i === 1 && !holeRevealed;
          return (
            <div key={hidden ? `hole-${card.id}` : card.id} className={i > 0 ? "-ml-8 sm:-ml-10" : ""}>
              <PlayingCard
                card={card}
                faceDown={hidden}
                animate={i === 1 && holeRevealed ? "flip" : "deal"}
                showTag={showTags && !hidden && i === cards.length - 1}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
