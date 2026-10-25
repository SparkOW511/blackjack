import { PlayingCard } from "@/components/PlayingCard";
import type { PlayerHand, Seat } from "@/lib/blackjack/game";
import { PROFILE_LABEL } from "@/lib/blackjack/seats";
import { formatMoney } from "@/lib/storage";
import { OUTCOME_STYLE, TotalPill } from "./HandView";

interface SeatViewProps {
  seat: Seat;
  isYou: boolean;
  /** This seat is the one acting right now. */
  isActive: boolean;
  showTags: boolean;
}

export function SeatView({ seat, isYou, isActive, showTags }: SeatViewProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl px-2 py-2 transition sm:px-3 ${
        isActive ? "bg-brass-400/10 ring-2 ring-brass-400/70" : isYou ? "bg-white/4" : ""
      }`}
    >
      <div className="flex flex-wrap items-end justify-center gap-3">
        {seat.hands.map((hand, h) => (
          <HandStack
            key={h}
            hand={hand}
            isYou={isYou}
            active={isActive && h === seat.activeHand && seat.hands.length > 1}
            dimmed={isActive && h !== seat.activeHand && !hand.done}
            showTags={showTags}
          />
        ))}
      </div>
      <div className="flex items-baseline gap-1.5 text-center text-[11px] leading-tight">
        <span className={isYou ? "font-semibold text-brass-200" : "text-white/55"}>{seat.name}</span>
        {seat.profile && <span className="hidden text-white/30 sm:inline">· {PROFILE_LABEL[seat.profile]}</span>}
      </div>
    </div>
  );
}

function HandStack({
  hand,
  isYou,
  active,
  dimmed,
  showTags,
}: {
  hand: PlayerHand;
  isYou: boolean;
  active: boolean;
  dimmed: boolean;
  showTags: boolean;
}) {
  const outcome = hand.outcome ? OUTCOME_STYLE[hand.outcome] : null;
  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-xl px-1.5 pb-1 pt-3 transition ${
        active ? "ring-2 ring-brass-400/70" : ""
      } ${dimmed ? "opacity-60" : ""}`}
    >
      {outcome && (
        <span
          className={`animate-pop absolute -top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-lg ${outcome.className}`}
        >
          {outcome.label}
        </span>
      )}
      <div className={`flex ${isYou ? "min-h-21 sm:min-h-[6.3rem]" : "min-h-16"}`}>
        {hand.cards.map((card, i) => (
          <div key={card.id} className={i > 0 ? (isYou ? "-ml-8 sm:-ml-10" : "-ml-6") : ""}>
            <PlayingCard card={card} size={isYou ? "md" : "sm"} showTag={showTags && i === hand.cards.length - 1} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <TotalPill cards={hand.cards} />
        <span className="rounded-full bg-brass-400/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-brass-200 ring-1 ring-brass-400/30">
          {formatMoney(hand.bet)}
          {hand.doubled ? " ×2" : ""}
        </span>
      </div>
    </div>
  );
}
