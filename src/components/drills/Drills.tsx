"use client";

import { useEffect, useRef, useState } from "react";
import { PlayingCard } from "@/components/PlayingCard";
import type { Card } from "@/lib/blackjack/cards";
import { hiLoValue } from "@/lib/blackjack/count";
import { buildDecks, cryptoRandomInt, shuffle } from "@/lib/blackjack/shoe";
import { formatSigned } from "@/lib/storage";

const TABS = [
  { id: "tags", label: "Card tags", blurb: "Instant +1 / 0 / −1 recognition." },
  { id: "flash", label: "Flash count", blurb: "Keep the running count as cards fly by." },
  { id: "countdown", label: "Deck countdown", blurb: "Count a full deck against the clock." },
  { id: "true", label: "True count", blurb: "Read the discard tray and convert." },
] as const;

type TabId = (typeof TABS)[number]["id"];

const sumTags = (cards: readonly Card[]) => cards.reduce((sum, c) => sum + hiLoValue(c.rank), 0);

export default function Drills() {
  const [tab, setTab] = useState<TabId>("tags");
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="font-display text-4xl font-semibold text-cream sm:text-5xl">Drills</h1>
      <p className="mt-2 max-w-2xl text-white/60">
        Counting has to be effortless before it’s useful at a table. Work left to right: tags until they’re reflex, then
        speed, then conversion.
      </p>

      <div role="tablist" className="mt-8 grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1 sm:grid-cols-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              tab === t.id ? "bg-brass-400 text-felt-950 shadow" : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-white/50">{active.blurb}</p>

      <div className="mt-6">
        {tab === "tags" && <TagsDrill />}
        {tab === "flash" && <FlashDrill />}
        {tab === "countdown" && <CountdownDrill />}
        {tab === "true" && <TrueCountDrill />}
      </div>
    </main>
  );
}

function DrillSurface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`felt felt-noise flex min-h-[26rem] flex-col items-center justify-center gap-6 rounded-[2rem] p-6 sm:p-10 ${className}`}>
      {children}
    </section>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-full bg-brass-400 px-6 py-3 font-semibold text-felt-950 shadow-lg shadow-brass-500/20 transition hover:bg-brass-300 disabled:opacity-40 ${props.className ?? ""}`}
    />
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-white/50">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              v === value ? "bg-cream text-felt-950" : "bg-felt-950/50 text-white/70 hover:text-white"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function CountInput({ onSubmit, prompt }: { onSubmit: (value: number) => void; prompt: string }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-col items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value);
        if (value.trim() !== "" && Number.isFinite(n)) onSubmit(n);
      }}
    >
      <label htmlFor="count-answer" className="font-display text-2xl text-cream">
        {prompt}
      </label>
      <div className="flex gap-2">
        <input
          id="count-answer"
          autoFocus
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.+-]/g, ""))}
          placeholder="0"
          className="w-28 rounded-2xl border border-white/15 bg-felt-950/70 px-4 py-3 text-center font-mono text-2xl text-cream outline-none focus:border-brass-400"
        />
        <PrimaryButton type="submit">Check</PrimaryButton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- tags

const TAG_KEYS: Record<string, 1 | 0 | -1> = { arrowleft: 1, arrowdown: 0, arrowright: -1, "1": 1, "2": 0, "3": -1 };

function TagsDrill() {
  const [deck, setDeck] = useState(() => shuffle(buildDecks(1)));
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState({ answered: 0, correct: 0, streak: 0, best: 0, totalMs: 0 });
  const [last, setLast] = useState<{ correct: boolean; card: Card } | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = performance.now();
  }, [index, deck]);

  const card = deck[index];

  const answer = (tag: 1 | 0 | -1) => {
    const correct = hiLoValue(card.rank) === tag;
    const ms = performance.now() - shownAt.current;
    setStats((s) => {
      const streak = correct ? s.streak + 1 : 0;
      return {
        answered: s.answered + 1,
        correct: s.correct + (correct ? 1 : 0),
        streak,
        best: Math.max(s.best, streak),
        totalMs: s.totalMs + ms,
      };
    });
    setLast({ correct, card });
    if (index + 1 >= deck.length) {
      setDeck(shuffle(buildDecks(1)));
      setIndex(0);
    } else {
      setIndex(index + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = TAG_KEYS[e.key.toLowerCase()];
      if (tag === undefined) return;
      e.preventDefault();
      answer(tag);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const avg = stats.answered ? Math.round(stats.totalMs / stats.answered) : null;

  return (
    <div className="flex flex-col gap-4">
      <DrillSurface>
        <PlayingCard key={card.id} card={card} size="lg" animate="pop" />
        <div className="grid w-full max-w-md grid-cols-3 gap-2">
          {([
            [1, "Low", "+1", "←"],
            [0, "Neutral", "0", "↓"],
            [-1, "High", "−1", "→"],
          ] as const).map(([tag, name, label, key]) => (
            <button
              key={tag}
              onClick={() => answer(tag)}
              className={`flex flex-col items-center rounded-2xl py-3 font-semibold transition hover:-translate-y-0.5 ${
                tag > 0 ? "bg-win/20 text-win hover:bg-win/30" : tag < 0 ? "bg-loss/20 text-loss hover:bg-loss/30" : "bg-white/10 text-cream hover:bg-white/20"
              }`}
            >
              <span className="font-mono text-2xl">{label}</span>
              <span className="text-xs opacity-80">
                {name} <kbd className="ml-1 font-mono">{key}</kbd>
              </span>
            </button>
          ))}
        </div>
        <div className="h-5 text-sm">
          {last && (
            <span key={stats.answered} className={`animate-pop inline-block ${last.correct ? "text-win" : "text-loss"}`}>
              {last.correct ? "✓" : "✗"} {last.card.rank} is {formatSigned(hiLoValue(last.card.rank), 0)}
            </span>
          )}
        </div>
      </DrillSurface>
      <StatRow
        items={[
          ["Accuracy", stats.answered ? `${Math.round((stats.correct / stats.answered) * 100)}%` : "—"],
          ["Streak", String(stats.streak)],
          ["Best streak", String(stats.best)],
          ["Avg. reaction", avg ? `${avg} ms` : "—"],
        ]}
      />
      <p className="text-center text-xs text-white/40">Goal: 100% accuracy under 500 ms before moving on.</p>
    </div>
  );
}

function StatRow({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/8 bg-felt-900/70 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
          <div className="font-mono text-xl text-cream tabular">{value}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- flash

type FlashStatus = "setup" | "running" | "answer" | "result";

function FlashDrill() {
  const [cardCount, setCardCount] = useState(20);
  const [perFlash, setPerFlash] = useState(1);
  const [speed, setSpeed] = useState(1000);
  const [status, setStatus] = useState<FlashStatus>("setup");
  const [sequence, setSequence] = useState<Card[]>([]);
  const [step, setStep] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "running") return;
    const timer = setTimeout(() => {
      if (step + perFlash >= sequence.length) setStatus("answer");
      else setStep(step + perFlash);
    }, speed);
    return () => clearTimeout(timer);
  }, [status, step, perFlash, speed, sequence.length]);

  const start = () => {
    setSequence(shuffle(buildDecks(6)).slice(0, cardCount));
    setStep(0);
    setGuess(null);
    setStatus("running");
  };

  const actual = sumTags(sequence);

  return (
    <DrillSurface>
      {status === "setup" && (
        <div className="flex w-full max-w-lg flex-col gap-5">
          <Choice label="Cards" value={cardCount} options={[[10, "10"], [20, "20"], [30, "30"], [52, "52"]]} onChange={setCardCount} />
          <Choice label="Cards per flash" value={perFlash} options={[[1, "1"], [2, "2"], [3, "3"]]} onChange={setPerFlash} />
          <Choice
            label="Speed"
            value={speed}
            options={[[1500, "Relaxed"], [1000, "Steady"], [650, "Fast"], [400, "Casino"]]}
            onChange={setSpeed}
          />
          <PrimaryButton onClick={start} className="mt-2 self-center">
            Start
          </PrimaryButton>
        </div>
      )}

      {status === "running" && (
        <>
          <div className="flex gap-3">
            {sequence.slice(step, step + perFlash).map((card, i) => (
              <PlayingCard key={card.id} card={card} size="lg" index={i} animate="pop" />
            ))}
          </div>
          <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-brass-400 transition-[width]" style={{ width: `${((step + perFlash) / sequence.length) * 100}%` }} />
          </div>
          <button onClick={() => setStatus("setup")} className="text-sm text-white/50 hover:text-white">
            Stop
          </button>
        </>
      )}

      {status === "answer" && (
        <CountInput
          prompt="What’s the running count?"
          onSubmit={(value) => {
            setGuess(value);
            setStatus("result");
          }}
        />
      )}

      {status === "result" && guess !== null && (
        <div className="flex w-full flex-col items-center gap-5">
          <div className={`animate-pop font-display text-3xl ${guess === actual ? "text-win" : "text-loss"}`}>
            {guess === actual ? "✓ Correct" : `✗ It was ${formatSigned(actual, 0)}`}
          </div>
          <ol className="flex max-w-full flex-wrap justify-center gap-x-1 gap-y-3">
            {sequence.map((card, i) => (
              <li key={card.id} className="flex flex-col items-center gap-1">
                <PlayingCard card={card} size="sm" animate="none" />
                <span className="font-mono text-[11px] text-white/60">{formatSigned(sumTags(sequence.slice(0, i + 1)), 0)}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <PrimaryButton onClick={start}>Again</PrimaryButton>
            <button onClick={() => setStatus("setup")} className="rounded-full px-5 py-3 text-white/70 hover:bg-white/5">
              Change settings
            </button>
          </div>
        </div>
      )}
    </DrillSurface>
  );
}

// ---------------------------------------------------------------- countdown

function CountdownDrill() {
  const [status, setStatus] = useState<FlashStatus>("setup");
  const [deck, setDeck] = useState<Card[]>([]);
  const [hidden, setHidden] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [guess, setGuess] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [status, startedAt]);

  const start = () => {
    const shuffled = shuffle(buildDecks(1));
    const hiddenCount = cryptoRandomInt(3) + 1;
    setHidden(shuffled.slice(0, hiddenCount));
    setDeck(shuffled.slice(hiddenCount));
    setIndex(0);
    setGuess(null);
    setElapsed(0);
    setStartedAt(Date.now());
    setStatus("running");
  };

  const next = () => {
    if (status !== "running") return;
    if (index + 1 >= deck.length) {
      setElapsed(Date.now() - startedAt);
      setStatus("answer");
    } else {
      setIndex(index + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (status === "running" && (e.key === " " || e.key === "ArrowRight")) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const actual = sumTags(deck);
  const seconds = (elapsed / 1000).toFixed(1);

  return (
    <DrillSurface>
      {status === "setup" && (
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-white/75">
            One to three cards are secretly removed from a shuffled deck. Flip through the rest as fast as you can, then
            name the final running count. Because Hi-Lo is balanced, the answer tells you what was removed.
          </p>
          {best !== null && <p className="font-mono text-sm text-brass-300">Best correct run: {(best / 1000).toFixed(1)} s</p>}
          <PrimaryButton onClick={start}>Start the clock</PrimaryButton>
        </div>
      )}

      {status === "running" && (
        <>
          <div className="font-mono text-3xl text-brass-200 tabular">{seconds}s</div>
          <button onClick={next} className="rounded-xl focus:outline-none" aria-label="Next card">
            <PlayingCard key={deck[index].id} card={deck[index]} size="lg" animate="pop" />
          </button>
          <p className="text-sm text-white/50">
            Card {index + 1} of {deck.length} · tap the card or press <kbd className="font-mono">Space</kbd>
          </p>
        </>
      )}

      {status === "answer" && (
        <CountInput
          prompt={`Done in ${seconds}s — final running count?`}
          onSubmit={(value) => {
            setGuess(value);
            if (value === actual) setBest((b) => (b === null ? elapsed : Math.min(b, elapsed)));
            setStatus("result");
          }}
        />
      )}

      {status === "result" && guess !== null && (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className={`animate-pop font-display text-3xl ${guess === actual ? "text-win" : "text-loss"}`}>
            {guess === actual ? `✓ Correct in ${seconds}s` : `✗ The count was ${formatSigned(actual, 0)}`}
          </div>
          <div>
            <p className="mb-3 text-sm text-white/60">The missing cards were</p>
            <div className="flex justify-center gap-2">
              {hidden.map((card, i) => (
                <PlayingCard key={card.id} card={card} index={i} showTag />
              ))}
            </div>
          </div>
          <p className="text-sm text-white/50">Under 30 s is solid. Pros get under 20 s.</p>
          <PrimaryButton onClick={start}>Another deck</PrimaryButton>
        </div>
      )}
    </DrillSurface>
  );
}

// ---------------------------------------------------------------- true count

interface TCProblem {
  running: number;
  decksDealt: number;
}

const SHOE_DECKS = 6;

function newProblem(): TCProblem {
  const decksDealt = (cryptoRandomInt(9) + 1) * 0.5; // 0.5 … 4.5
  const magnitude = cryptoRandomInt(16);
  return { running: cryptoRandomInt(3) === 0 ? -magnitude : magnitude, decksDealt };
}

function TrueCountDrill() {
  const [problem, setProblem] = useState(newProblem);
  const [guess, setGuess] = useState<number | null>(null);
  const [stats, setStats] = useState({ answered: 0, correct: 0 });

  const decksLeft = SHOE_DECKS - problem.decksDealt;
  const exact = problem.running / decksLeft;
  const isCorrect = (g: number) => g === Math.round(exact) || g === Math.trunc(exact) || Math.abs(g - exact) < 0.05;

  return (
    <div className="flex flex-col gap-4">
      <DrillSurface className="sm:flex-row sm:gap-12">
        <DiscardTray decksDealt={problem.decksDealt} />
        <div className="flex flex-col items-center gap-6 text-center">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Running count</div>
            <div className="font-mono text-6xl font-semibold text-brass-200">{formatSigned(problem.running, 0)}</div>
            <p className="mt-2 text-sm text-white/55">6-deck shoe. Read the discard tray to estimate decks remaining.</p>
          </div>
          {guess === null ? (
            <CountInput
              key={`${problem.running}-${problem.decksDealt}`}
              prompt="True count?"
              onSubmit={(value) => {
                setGuess(value);
                setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (isCorrect(value) ? 1 : 0) }));
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className={`animate-pop font-display text-3xl ${isCorrect(guess) ? "text-win" : "text-loss"}`}>
                {isCorrect(guess) ? "✓ Correct" : "✗ Not quite"}
              </div>
              <p className="font-mono text-white/80">
                {formatSigned(problem.running, 0)} ÷ {decksLeft} decks = {formatSigned(exact, 2)}
              </p>
              <p className="text-xs text-white/45">Rounded or truncated answers both count.</p>
              <PrimaryButton
                onClick={() => {
                  setProblem(newProblem());
                  setGuess(null);
                }}
              >
                Next
              </PrimaryButton>
            </div>
          )}
        </div>
      </DrillSurface>
      <StatRow
        items={[
          ["Answered", String(stats.answered)],
          ["Correct", String(stats.correct)],
          ["Accuracy", stats.answered ? `${Math.round((stats.correct / stats.answered) * 100)}%` : "—"],
          ["Shoe", `${SHOE_DECKS} decks`],
        ]}
      />
    </div>
  );
}

function DiscardTray({ decksDealt }: { decksDealt: number }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative h-60 w-20 rounded-lg border-2 border-brass-500/60 bg-felt-950/60 p-1">
        <div
          className="absolute inset-x-1 bottom-1 rounded-sm transition-[height] duration-500"
          style={{
            height: `calc(${(decksDealt / SHOE_DECKS) * 100}% - 0.5rem)`,
            backgroundImage: "repeating-linear-gradient(0deg, #fbf7ee 0 2px, #d9d2c2 2px 3px)",
          }}
        />
        {Array.from({ length: SHOE_DECKS - 1 }, (_, i) => (
          <span key={i} className="absolute -right-3 h-px w-3 bg-white/40" style={{ bottom: `${((i + 1) / SHOE_DECKS) * 100}%` }} />
        ))}
      </div>
      <figcaption className="text-xs text-white/50">Discard tray · ticks = 1 deck</figcaption>
    </figure>
  );
}
