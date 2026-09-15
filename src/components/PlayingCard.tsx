import { type Card, isRed } from "@/lib/blackjack/cards";
import { hiLoValue } from "@/lib/blackjack/count";

const SIZES = {
  sm: "w-11 h-16 text-xs rounded-md",
  md: "w-[3.75rem] h-[5.25rem] text-sm sm:w-[4.5rem] sm:h-[6.3rem] sm:text-base rounded-lg",
  lg: "w-24 h-[8.4rem] text-lg sm:w-32 sm:h-[11.2rem] sm:text-2xl rounded-xl",
} as const;

const CENTER = { sm: "text-2xl", md: "text-3xl sm:text-4xl", lg: "text-5xl sm:text-7xl" } as const;

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: keyof typeof SIZES;
  /** Staggers the deal animation. */
  index?: number;
  /** Shows the card's Hi-Lo tag as a badge. */
  showTag?: boolean;
  animate?: "deal" | "flip" | "pop" | "none";
}

export function PlayingCard({ card, faceDown, size = "md", index = 0, showTag, animate = "deal" }: PlayingCardProps) {
  const animation = animate === "none" ? "" : `animate-${animate}`;
  const style = { animationDelay: `${index * 90}ms` };

  if (faceDown || !card) {
    return (
      <div
        className={`card-back relative shrink-0 shadow-lg shadow-black/40 ${SIZES[size]} ${animation}`}
        style={style}
        aria-label="Face-down card"
        role="img"
      />
    );
  }

  const red = isRed(card.suit);
  const tag = hiLoValue(card.rank);
  return (
    <div
      className={`relative shrink-0 select-none bg-cream font-semibold shadow-lg shadow-black/40 ring-1 ring-black/10 ${
        red ? "text-suit-red" : "text-ink"
      } ${SIZES[size]} ${animation}`}
      style={style}
      role="img"
      aria-label={`${card.rank} of ${suitName(card.suit)}`}
    >
      <span className="absolute left-1.5 top-1 flex flex-col items-center leading-none">
        <span>{card.rank}</span>
        <span className="text-[0.8em]">{card.suit}</span>
      </span>
      <span className={`absolute inset-0 grid place-items-center ${CENTER[size]}`}>{card.suit}</span>
      <span className="absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center leading-none">
        <span>{card.rank}</span>
        <span className="text-[0.8em]">{card.suit}</span>
      </span>
      {showTag && (
        <span
          className={`absolute -right-2 -top-2 grid size-6 place-items-center rounded-full font-mono text-[11px] font-bold shadow ring-2 ring-felt-900 ${
            tag > 0 ? "bg-win text-felt-950" : tag < 0 ? "bg-loss text-felt-950" : "bg-white/80 text-felt-950"
          }`}
        >
          {tag > 0 ? "+1" : tag < 0 ? "−1" : "0"}
        </span>
      )}
    </div>
  );
}

function suitName(suit: Card["suit"]): string {
  return { "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs" }[suit];
}
