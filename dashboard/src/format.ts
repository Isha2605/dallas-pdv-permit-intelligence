export const money = (n: number | null | undefined, compact = false) =>
  n == null
    ? "Not available"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: compact ? "compact" : "standard",
        ...(compact ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: 0 }),
      }).format(n);

// Display-only cleanup; the source description remains available in a tooltip.
export function formatWorkDescription(raw: string): string {
  let text = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  // Known incomplete endings in this export; avoid guessing whether arbitrary
  // complete words are truncated simply from their character count.
  if (raw.length >= 64) text = text.replace(/(?:\s+to|\s+(?:a\s+)?multi-l)$/, '…');
  text = text.replace(/\bre-pair\b/g, 'repair')
    .replace(/\bmulti[ -]+family\b/g, 'multifamily')
    .replace(/\bsfd\b/g, 'single-family home')
    .replace(/\bmfd\b/g, 'multifamily')
    .replace(/\bdemo\b/g, 'demolish')
    .replace(/\bbldg\.?/g, 'building')
    .replace(/\b(hvac|pv)\b/g, s => s.toUpperCase())
    .replace(/\batmos\b/g, 'Atmos');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
