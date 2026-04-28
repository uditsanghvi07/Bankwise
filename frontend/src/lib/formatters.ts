const INR_FORMAT = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  return `₹${INR_FORMAT.format(Math.round(amount * 100) / 100)}`;
}

export function formatPercent(rate: number, decimals = 2): string {
  if (!Number.isFinite(rate)) return "0%";
  return `${rate.toFixed(decimals)}%`;
}

export function formatMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m === 1 ? "" : "s"}`;
  if (m === 0) return `${y} year${y === 1 ? "" : "s"}`;
  return `${y} year${y === 1 ? "" : "s"} ${m} month${m === 1 ? "" : "s"}`;
}

export function formatLargeINR(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "₹0";
  const crore = 1e7;
  const lakh = 1e5;
  if (amount >= crore) {
    return `₹${(amount / crore).toFixed(2)} Crore`;
  }
  if (amount >= lakh) {
    return `₹${(amount / lakh).toFixed(2)} Lakh`;
  }
  return formatINR(amount);
}
