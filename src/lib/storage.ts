/** localStorage helpers that never throw (private windows, blocked storage, quota). */
export function loadJSON<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is a convenience; the app works without it.
  }
}

export function formatMoney(amount: number, signed = false): string {
  const abs = Math.abs(amount);
  const body = `$${abs.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: abs % 1 ? 2 : 0 })}`;
  if (!signed) return amount < 0 ? `−${body}` : body;
  return amount > 0 ? `+${body}` : amount < 0 ? `−${body}` : body;
}

export function formatSigned(value: number, digits = 1): string {
  const fixed = Math.abs(value).toFixed(digits);
  if (Number(fixed) === 0) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${fixed}`;
}

export function formatPercent(value: number, digits = 1, signed = false): string {
  const pct = value * 100;
  return signed ? `${formatSigned(pct, digits)}%` : `${pct.toFixed(digits)}%`;
}
