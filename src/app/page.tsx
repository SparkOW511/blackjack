import Link from "next/link";
import { PlayingCard } from "@/components/PlayingCard";
import type { Card } from "@/lib/blackjack/cards";

const HERO_CARDS: Card[] = [
  { rank: "5", suit: "♥", id: "h1" },
  { rank: "K", suit: "♠", id: "h2" },
  { rank: "2", suit: "♣", id: "h3" },
  { rank: "A", suit: "♦", id: "h4" },
  { rank: "6", suit: "♠", id: "h5" },
];

const STEPS = [
  {
    href: "/learn",
    step: "01",
    title: "Learn the system",
    body: "Why counting works, the Hi-Lo tags, converting to a true count, betting with the edge, and the index plays that matter.",
    cta: "Start the lessons",
  },
  {
    href: "/drills",
    step: "02",
    title: "Drill until it’s automatic",
    body: "Card-tag reflexes, flashed card runs, full-deck countdowns against the clock, and true-count conversion from a discard tray.",
    cta: "Open the drills",
  },
  {
    href: "/play",
    step: "03",
    title: "Sit down at the table",
    body: "Play a live-shuffled 6-deck shoe with a coach that grades every decision, quizzes your count, and shows the exact odds.",
    cta: "Take a seat",
  },
] as const;

const REALISM = [
  ["Live shuffle", "Every shoe is shuffled with an unbiased Fisher–Yates shuffle driven by the browser’s cryptographic RNG."],
  ["Casino procedure", "Cut card placed at ~75% penetration with dealer variance, a face-down burn card, peek for blackjack, and shuffles only between rounds."],
  ["Exact odds", "Dealer outcomes are calculated card-by-card from what you haven’t seen, including the hole card and the burn."],
  ["Verified edge", "A 300,000-round simulation of basic strategy lands on the published house edge for the rules you choose."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <section className="grid items-center gap-12 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brass-400/30 bg-brass-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-brass-300">
            Hi-Lo card counting trainer
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-cream sm:text-6xl lg:text-7xl">
            Turn the house edge <em className="font-normal text-brass-400">around.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Learn to count cards the way professionals do, then practice against a shoe that behaves exactly like the
            one on a casino floor — real shuffles, real penetration, real odds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/learn"
              className="rounded-full bg-brass-400 px-6 py-3 font-semibold text-felt-950 shadow-lg shadow-brass-500/20 transition hover:bg-brass-300"
            >
              Start learning
            </Link>
            <Link
              href="/play"
              className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
            >
              Jump to the table
            </Link>
          </div>
        </div>

        <div className="felt felt-noise relative mx-auto flex aspect-5/4 w-full max-w-lg flex-col items-center justify-center rounded-[2.5rem] p-6">
          <div className="flex -space-x-6 sm:-space-x-8">
            {HERO_CARDS.map((card, i) => (
              <div key={card.id} style={{ transform: `rotate(${(i - 2) * 7}deg) translateY(${Math.abs(i - 2) * 8}px)` }}>
                <PlayingCard card={card} size="lg" index={i} showTag={i === HERO_CARDS.length - 1} />
              </div>
            ))}
          </div>
          <div className="mt-10 flex items-center gap-6 rounded-2xl bg-felt-950/60 px-5 py-3 ring-1 ring-brass-400/20">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">Running</div>
              <div className="font-mono text-2xl font-semibold text-win">+1</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">Decks left</div>
              <div className="font-mono text-2xl font-semibold text-cream">0.5</div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/50">True</div>
              <div className="font-mono text-2xl font-semibold text-brass-300">+2</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 pb-16 md:grid-cols-3">
        {STEPS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col rounded-3xl border border-white/8 bg-white/3 p-6 transition hover:-translate-y-0.5 hover:border-brass-400/40 hover:bg-white/5"
          >
            <span className="font-mono text-sm text-brass-400">{s.step}</span>
            <h2 className="mt-3 font-display text-2xl font-semibold text-cream">{s.title}</h2>
            <p className="mt-2 flex-1 leading-relaxed text-white/60">{s.body}</p>
            <span className="mt-6 text-sm font-semibold text-brass-300 transition group-hover:translate-x-1">
              {s.cta} →
            </span>
          </Link>
        ))}
      </section>

      <section className="mb-20 rounded-3xl border border-white/8 bg-felt-900/60 p-6 sm:p-10">
        <h2 className="font-display text-3xl font-semibold text-cream">Built to behave like a real shoe</h2>
        <p className="mt-2 max-w-2xl text-white/60">
          Counting only works because blackjack has memory. A trainer that reshuffles every hand or fudges odds teaches
          you nothing — so this one doesn’t.
        </p>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          {REALISM.map(([term, desc]) => (
            <div key={term} className="border-l-2 border-brass-400/50 pl-4">
              <dt className="font-semibold text-brass-200">{term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-white/60">{desc}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
