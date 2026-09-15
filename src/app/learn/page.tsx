import type { Metadata } from "next";
import Link from "next/link";
import { PlayingCard } from "@/components/PlayingCard";
import { StrategyChart } from "@/components/learn/StrategyChart";
import type { Card, Rank } from "@/lib/blackjack/cards";
import { hiLoValue } from "@/lib/blackjack/count";

export const metadata: Metadata = {
  title: "Learn — True Count",
  description: "A complete course in Hi-Lo card counting: tags, running count, true count, betting and index plays.",
};

const card = (rank: Rank, suit: Card["suit"], id: string): Card => ({ rank, suit, id });

const EXAMPLE_RUN: Card[] = [
  card("K", "♠", "e1"),
  card("4", "♥", "e2"),
  card("9", "♣", "e3"),
  card("2", "♦", "e4"),
  card("5", "♠", "e5"),
  card("A", "♥", "e6"),
  card("6", "♣", "e7"),
  card("3", "♦", "e8"),
];

const LESSONS = [
  ["why", "Why counting works"],
  ["tags", "The Hi-Lo tags"],
  ["running", "Keeping the running count"],
  ["true", "Converting to a true count"],
  ["betting", "Betting with the edge"],
  ["strategy", "Basic strategy"],
  ["indices", "Index plays"],
  ["casino", "At a real casino"],
] as const;

const INDEX_PLAYS: [string, string, string][] = [
  ["Insurance", "Take it", "+3 or higher"],
  ["16 vs 10", "Stand", "0 or higher"],
  ["15 vs 10", "Stand", "+4 or higher"],
  ["10,10 vs 5", "Split", "+5 or higher"],
  ["10,10 vs 6", "Split", "+4 or higher"],
  ["10 vs 10", "Double", "+4 or higher"],
  ["12 vs 3", "Stand", "+2 or higher"],
  ["12 vs 2", "Stand", "+3 or higher"],
  ["11 vs A", "Double", "+1 or higher (S17)"],
  ["9 vs 2", "Double", "+1 or higher"],
  ["10 vs A", "Double", "+4 (S17) · +3 (H17)"],
  ["9 vs 7", "Double", "+3 or higher"],
  ["16 vs 9", "Stand", "+5 or higher"],
  ["13 vs 2", "Hit", "−1 or lower"],
  ["12 vs 4", "Hit", "below 0"],
  ["12 vs 5", "Hit", "−2 or lower"],
  ["12 vs 6", "Hit", "−1 or lower"],
  ["13 vs 3", "Hit", "−2 or lower"],
];

const SPREAD: [string, string, string][] = [
  ["+1 or less", "1 unit", "House still has the edge — bet the minimum (or leave)"],
  ["+2", "2 units", "Roughly break-even to a slight player edge"],
  ["+3", "4 units", "About +1% to the player"],
  ["+4", "8 units", "About +1.5%"],
  ["+5 and up", "12 units", "+2% and climbing"],
];

function Lesson({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-white/8 py-12 first:border-t-0 first:pt-0">
      <p className="font-mono text-sm text-brass-400">Lesson {String(n).padStart(2, "0")}</p>
      <h2 className="mt-1 font-display text-3xl font-semibold text-cream sm:text-4xl">{title}</h2>
      <div className="mt-5 flex flex-col gap-4 leading-relaxed text-white/75 [&_strong]:text-cream">{children}</div>
    </section>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-brass-400/25 bg-brass-400/8 p-4 text-sm text-brass-100">{children}</div>;
}

const RUNNING_TOTALS = EXAMPLE_RUN.map((_, i) =>
  EXAMPLE_RUN.slice(0, i + 1).reduce((sum, c) => sum + hiLoValue(c.rank), 0),
);

export default function LearnPage() {
  const runningTotals = RUNNING_TOTALS;

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-16">
      <nav className="hidden lg:block" aria-label="Lessons">
        <ol className="sticky top-24 flex flex-col gap-1 text-sm">
          {LESSONS.map(([id, title], i) => (
            <li key={id}>
              <a href={`#${id}`} className="flex gap-3 rounded-lg px-3 py-2 text-white/60 transition hover:bg-white/5 hover:text-white">
                <span className="font-mono text-brass-400/70">{String(i + 1).padStart(2, "0")}</span>
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="min-w-0 max-w-3xl">
        <header className="mb-12">
          <h1 className="font-display text-5xl font-semibold tracking-tight text-cream sm:text-6xl">The counting course</h1>
          <p className="mt-4 text-lg text-white/65">
            Eight short lessons take you from “what’s a running count?” to the index plays professionals use. Read one,
            then practise it in the drills.
          </p>
        </header>

        <Lesson id="why" n={1} title="Why counting works">
          <p>
            Roulette has no memory: every spin is independent. <strong>Blackjack does.</strong> Cards dealt from a shoe
            don’t go back in until the shuffle, so every hand changes what’s left — and therefore the odds of the next
            hand.
          </p>
          <p>When the remaining cards are rich in <strong>tens and aces</strong>, the player gains:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Blackjacks come more often, and you’re paid 3:2 on them while the dealer only wins even money on theirs.</li>
            <li>The dealer must hit stiff hands (12–16) and busts more often when tens are plentiful.</li>
            <li>Doubles on 10 and 11 land a ten more often.</li>
            <li>Insurance becomes a profitable bet once more than a third of the unseen cards are tens.</li>
          </ul>
          <p>
            When small cards (2–6) are left, the dealer benefits instead: they rescue stiff hands. Counting is simply
            tracking which kind of shoe you’re in, and <strong>betting more when it favours you</strong>.
          </p>
        </Lesson>

        <Lesson id="tags" n={2} title="The Hi-Lo tags">
          <p>Hi-Lo gives every card one of three values. You never add card values — only these tags.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["+1", "Low cards", ["2", "3", "4", "5", "6"], "text-win"],
                ["0", "Neutral", ["7", "8", "9"], "text-cream"],
                ["−1", "High cards", ["10", "J", "Q", "K", "A"], "text-loss"],
              ] as const
            ).map(([tag, name, ranks, color]) => (
              <div key={tag} className="rounded-2xl border border-white/8 bg-felt-900/70 p-4">
                <div className={`font-mono text-3xl font-bold ${color}`}>{tag}</div>
                <div className="text-sm text-white/60">{name}</div>
                <div className="mt-3 font-mono text-cream">{ranks.join("  ")}</div>
              </div>
            ))}
          </div>
          <p>
            A full deck has twenty +1s and twenty −1s, so counting a whole deck <strong>always ends at zero</strong>. That
            makes Hi-Lo a <em>balanced</em> count — and gives you a free self-test in the deck countdown drill.
          </p>
          <Callout>
            <strong>Speed tip:</strong> cancel pairs. A high and a low card on the table together are worth 0 — skip them
            and count only what’s left over.
          </Callout>
        </Lesson>

        <Lesson id="running" n={3} title="Keeping the running count">
          <p>
            Start at 0 after every shuffle and add each card’s tag as it becomes visible: yours, other players’, the
            dealer’s upcard, and the hole card when it’s flipped. The burn card is never seen, so it’s never counted.
          </p>
          <div className="overflow-x-auto rounded-2xl bg-felt-900/70 p-4">
            <ol className="flex min-w-max gap-3">
              {EXAMPLE_RUN.map((c, i) => (
                <li key={c.id} className="flex flex-col items-center gap-2">
                  <PlayingCard card={c} size="sm" animate="none" />
                  <span className="font-mono text-xs text-white/50">{hiLoValue(c.rank) > 0 ? "+1" : hiLoValue(c.rank) < 0 ? "−1" : "0"}</span>
                  <span className="rounded-full bg-white/8 px-2 font-mono text-sm text-cream">
                    {runningTotals[i] > 0 ? `+${runningTotals[i]}` : runningTotals[i] < 0 ? `−${-runningTotals[i]}` : 0}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <p>
            Eight cards in, the running count is <strong>+3</strong>: three more low cards than high cards have left the
            shoe.
          </p>
        </Lesson>

        <Lesson id="true" n={4} title="Converting to a true count">
          <p>
            A running count of +6 means very different things with six decks left versus one. The{" "}
            <strong>true count</strong> measures the surplus per deck:
          </p>
          <p className="rounded-2xl bg-felt-900/70 p-5 text-center font-mono text-xl text-cream">
            true count = running count ÷ decks remaining
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Running +6 with 3 decks left → true count <strong>+2</strong>.</li>
            <li>Running +6 with 1½ decks left → true count <strong>+4</strong>.</li>
            <li>Running −4 with 4 decks left → true count <strong>−1</strong>.</li>
          </ul>
          <p>
            At a table you estimate decks remaining by glancing at the <strong>discard tray</strong> and subtracting from
            the shoe size, to the nearest half deck. Every bet and every index play keys off the true count, never the
            running count.
          </p>
        </Lesson>

        <Lesson id="betting" n={5} title="Betting with the edge">
          <p>
            With good rules a basic strategy player faces a house edge of roughly 0.5%. Each +1 of true count is worth
            about <strong>+0.5% to the player</strong>, so the edge flips in your favour somewhere around +1 to +2.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-brass-300">
                <tr>
                  <th className="py-2 pr-4">True count</th>
                  <th className="py-2 pr-4">Bet</th>
                  <th className="py-2">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {SPREAD.map(([tc, bet, why]) => (
                  <tr key={tc}>
                    <td className="py-2.5 pr-4 font-mono text-cream">{tc}</td>
                    <td className="py-2.5 pr-4 font-mono text-brass-200">{bet}</td>
                    <td className="py-2.5 text-white/60">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Your long-run win comes almost entirely from the few hands you play at high counts, and blackjack is
            volatile: the standard deviation of a hand is about 1.15 bets. Expect losing sessions — even losing weeks —
            and keep a bankroll of <strong>several hundred top bets</strong>.
          </p>
        </Lesson>

        <Lesson id="strategy" n={6} title="Basic strategy">
          <p>
            Counting is worthless if you misplay your hands. Basic strategy is the mathematically best play for every hand
            with no count information, and it must be perfect before you add counting. Learn pairs first, then soft
            hands, then hard totals.
          </p>
          <StrategyChart />
        </Lesson>

        <Lesson id="indices" n={7} title="Index plays">
          <p>
            Some decisions change when the count moves. These are the <strong>Illustrious 18</strong>: the eighteen
            deviations that capture most of the value of playing by the count. Deviate when the true count reaches the
            index.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-104 text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-brass-300">
                <tr>
                  <th className="py-2 pr-4">Hand</th>
                  <th className="py-2 pr-4">Play</th>
                  <th className="py-2">When true count is</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {INDEX_PLAYS.map(([hand, play, when]) => (
                  <tr key={hand}>
                    <td className="py-2 pr-4 font-mono text-cream">{hand}</td>
                    <td className="py-2 pr-4 text-brass-200">{play}</td>
                    <td className="py-2 font-mono text-white/70">{when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout>
            Insurance at +3 is the single most valuable index. At the table, the coach grades every one of these plays and
            tells you when you missed a deviation.
          </Callout>
        </Lesson>

        <Lesson id="casino" n={8} title="At a real casino">
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Rules matter.</strong> Never play 6:5 blackjack — it adds about 1.4% to the house edge, more than a
              counter can overcome. Look for 3:2, S17 and double after split.
            </li>
            <li>
              <strong>Penetration matters.</strong> The deeper the cut card, the more high counts you’ll see. Below ~70% on
              a six-deck shoe, counting struggles to win.
            </li>
            <li>
              <strong>Continuous shuffling machines</strong> return cards to the shoe after every round, which makes
              counting useless. This trainer models a hand-shuffled shoe with a cut card.
            </li>
            <li>
              <strong>Counting is legal</strong> — you’re just using your memory — but casinos are private property and
              can limit your bets or ask you to leave. Keep your spread and behaviour natural.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/drills" className="rounded-full bg-brass-400 px-6 py-3 font-semibold text-felt-950 hover:bg-brass-300">
              Practise in the drills
            </Link>
            <Link href="/play" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white hover:bg-white/5">
              Go to the table
            </Link>
          </div>
        </Lesson>
      </article>
    </main>
  );
}
