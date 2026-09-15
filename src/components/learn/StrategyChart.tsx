"use client";

import { useState } from "react";
import { DEFAULT_RULES } from "@/lib/blackjack/rules";
import { type Code, DEALER_COLUMNS, strategyCharts } from "@/lib/blackjack/strategy";

type Display = "H" | "S" | "D" | "Ds" | "P";

const CELL: Record<Display, string> = {
  H: "bg-white/10 text-white/80",
  S: "bg-brass-400/80 text-felt-950",
  D: "bg-win/80 text-felt-950",
  Ds: "bg-win/50 text-felt-950",
  P: "bg-sky-400/80 text-felt-950",
};

export function StrategyChart() {
  const [h17, setH17] = useState(true);
  const [das, setDas] = useState(true);
  const charts = strategyCharts({ ...DEFAULT_RULES, dealerHitsSoft17: h17 });

  const display = (code: Code): Display => {
    switch (code) {
      case "Ph":
        return das ? "P" : "H";
      default:
        return code;
    }
  };

  const sections: { title: string; rows: [string, Code[]][] }[] = [
    {
      title: "Hard totals",
      rows: Object.entries(charts.hard).map(([t, row]) => [t === "8" ? "≤ 8" : t === "17" ? "17+" : t, row]),
    },
    {
      title: "Soft totals",
      rows: Object.entries(charts.soft)
        .filter(([t]) => Number(t) >= 13)
        .map(([t, row]) => [`A,${Number(t) - 11}`, row]),
    },
    {
      title: "Pairs",
      rows: Object.entries(charts.pairs)
        .sort(([a], [b]) => (a === "1" ? 1 : b === "1" ? -1 : Number(a) - Number(b)))
        .map(([v, row]) => [v === "1" ? "A,A" : `${v},${v}`, row]),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Toggle on={h17} onClick={() => setH17(!h17)} labels={["Dealer hits soft 17", "Dealer stands soft 17"]} />
        <Toggle on={das} onClick={() => setDas(!das)} labels={["Double after split", "No double after split"]} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
        {(
          [
            ["H", "Hit"],
            ["S", "Stand"],
            ["D", "Double, else hit"],
            ["Ds", "Double, else stand"],
            ["P", "Split"],
          ] as [Display, string][]
        ).map(([d, text]) => (
          <span key={d} className="flex items-center gap-1.5">
            <span className={`grid h-5 w-6 place-items-center rounded font-mono text-[10px] font-bold ${CELL[d]}`}>{d}</span>
            {text}
          </span>
        ))}
      </div>
      <div className="grid gap-8">
        {sections.map((section) => (
          <div key={section.title} className="overflow-x-auto">
            <table className="w-full min-w-88 max-w-2xl table-fixed border-separate border-spacing-0.5 text-center font-mono text-xs">
              <caption className="mb-2 text-left font-sans text-sm font-semibold text-cream">{section.title}</caption>
              <thead>
                <tr>
                  <th className="w-20 text-left font-sans text-[10px] font-normal text-white/40">You \ Dealer</th>
                  {DEALER_COLUMNS.map((c) => (
                    <th key={c} className="py-1 text-brass-300">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map(([label, row]) => (
                  <tr key={label}>
                    <th className="whitespace-nowrap pr-2 text-left text-white/70">{label}</th>
                    {row.map((code, i) => {
                      const d = display(code);
                      return (
                        <td key={i} className={`rounded py-1.5 font-bold ${CELL[d]}`}>
                          {d}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, labels }: { on: boolean; onClick: () => void; labels: [string, string] }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        on ? "bg-brass-400 text-felt-950" : "bg-white/8 text-white/70 hover:text-white"
      }`}
    >
      {on ? labels[0] : labels[1]}
    </button>
  );
}
