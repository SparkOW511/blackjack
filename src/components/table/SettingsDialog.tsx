"use client";

import { useEffect, useRef, useState } from "react";
import { type Rules, baseHouseEdge } from "@/lib/blackjack/rules";
import { formatPercent } from "@/lib/storage";

export interface TrainerSettings {
  showCount: boolean;
  showOdds: boolean;
  coachBeforeActing: boolean;
  showTags: boolean;
  /** Ask for the running count every N rounds (0 = never). */
  quizEvery: 0 | 1 | 3 | 5;
  /** Base betting unit in dollars for the bet spread. */
  unit: number;
}

export const DEFAULT_SETTINGS: TrainerSettings = {
  showCount: true,
  showOdds: true,
  coachBeforeActing: false,
  showTags: false,
  quizEvery: 0,
  unit: 10,
};

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  rules: Rules;
  settings: TrainerSettings;
  canChangeRules: boolean;
  onApply: (rules: Rules, settings: TrainerSettings) => void;
  onResetSession: () => void;
}

export function SettingsDialog({ open, onClose, rules, settings, canChangeRules, onApply, onResetSession }: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draftRules, setDraftRules] = useState(rules);
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const setRule = <K extends keyof Rules>(key: K, value: Rules[K]) => setDraftRules((r) => ({ ...r, [key]: value }));
  const setSetting = <K extends keyof TrainerSettings>(key: K, value: TrainerSettings[K]) => setDraft((s) => ({ ...s, [key]: value }));

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-felt-900 p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form
        method="dialog"
        className="flex max-h-[85vh] flex-col"
        onSubmit={() => onApply(draftRules, draft)}
      >
        <div className="overflow-y-auto p-6">
          <h2 className="font-display text-2xl font-semibold text-cream">Table settings</h2>

          <fieldset className="mt-6" disabled={!canChangeRules}>
            <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-300">House rules</legend>
            {!canChangeRules && <p className="mt-1 text-xs text-white/50">Finish the current hand to change rules.</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Select
                label="Decks"
                value={String(draftRules.decks)}
                options={[["2", "2 decks"], ["4", "4 decks"], ["6", "6 decks"], ["8", "8 decks"]]}
                onChange={(v) => setRule("decks", Number(v) as Rules["decks"])}
              />
              <Select
                label="Dealer on soft 17"
                value={draftRules.dealerHitsSoft17 ? "h17" : "s17"}
                options={[["h17", "Hits (H17)"], ["s17", "Stands (S17)"]]}
                onChange={(v) => setRule("dealerHitsSoft17", v === "h17")}
              />
              <Select
                label="Blackjack pays"
                value={String(draftRules.blackjackPayout)}
                options={[["1.5", "3 to 2"], ["1.2", "6 to 5 (avoid!)"]]}
                onChange={(v) => setRule("blackjackPayout", Number(v) as Rules["blackjackPayout"])}
              />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-white/70">
                  Penetration <span className="font-mono text-cream">{Math.round(draftRules.penetration * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={draftRules.penetration * 100}
                  onChange={(e) => setRule("penetration", Number(e.target.value) / 100)}
                  className="accent-brass-400"
                />
              </label>
              <Toggle label="Double after split" checked={draftRules.doubleAfterSplit} onChange={(v) => setRule("doubleAfterSplit", v)} />
            </div>
            <p className="mt-3 text-xs text-white/50">
              Off-the-top house edge with these rules:{" "}
              <span className="font-mono text-cream">{formatPercent(baseHouseEdge(draftRules), 2)}</span>. Changing rules
              shuffles a new shoe.
            </p>
          </fieldset>

          <fieldset className="mt-8">
            <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-brass-300">Training aids</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Toggle label="Show running & true count" checked={draft.showCount} onChange={(v) => setSetting("showCount", v)} />
              <Toggle label="Show live odds & EV" checked={draft.showOdds} onChange={(v) => setSetting("showOdds", v)} />
              <Toggle label="Highlight the right play before I act" checked={draft.coachBeforeActing} onChange={(v) => setSetting("coachBeforeActing", v)} />
              <Toggle label="Show Hi-Lo tags on cards" checked={draft.showTags} onChange={(v) => setSetting("showTags", v)} />
              <Select
                label="Count check"
                value={String(draft.quizEvery)}
                options={[["0", "Off"], ["1", "Every round"], ["3", "Every 3 rounds"], ["5", "Every 5 rounds"]]}
                onChange={(v) => setSetting("quizEvery", Number(v) as TrainerSettings["quizEvery"])}
              />
              <Select
                label="Betting unit"
                value={String(draft.unit)}
                options={[["5", "$5"], ["10", "$10"], ["25", "$25"], ["100", "$100"]]}
                onChange={(v) => setSetting("unit", Number(v))}
              />
            </div>
          </fieldset>

          <div className="mt-8 flex items-center justify-between rounded-2xl bg-white/5 p-4">
            <div>
              <div className="text-sm font-medium">Reset session</div>
              <div className="text-xs text-white/50">Bankroll back to $1,000 and stats cleared.</div>
            </div>
            <button
              type="button"
              disabled={!canChangeRules}
              onClick={onResetSession}
              className="rounded-full border border-loss/50 px-4 py-1.5 text-sm font-medium text-loss transition hover:bg-loss/10 disabled:opacity-40"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/8 p-4">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-2 text-sm font-medium text-white/70 hover:bg-white/5">
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-brass-400 px-5 py-2 text-sm font-semibold text-felt-950 hover:bg-brass-300">
            Apply
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-white/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/10 bg-felt-950 px-3 py-2 text-cream outline-none focus:border-brass-400"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-sm">
      <span className="text-white/80">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-5 w-9 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-brass-400 peer-focus-visible:ring-2 peer-focus-visible:ring-brass-300 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}
