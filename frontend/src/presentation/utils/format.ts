/**
 * Formats a number as currency (USD).
 * e.g. 12345.6 → "$12,345.60"
 */
export function formatCurrency(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a decimal as percentage.
 * e.g. 0.0525 → "5.25%"
 */
export function formatPercent(value: number, decimals = 4): string {
  if (!isFinite(value)) return "—";
  return (value * 100).toFixed(decimals).replace(/\.?0+$/, "") + "%";
}

/**
 * Formats a plain number with thousand separators.
 * e.g. 12345.678 → "12,345.68"
 */
export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return "—";
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
