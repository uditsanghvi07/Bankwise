/**
 * Sanitize digit-only fields for controlled inputs: no stuck "0", no "010000".
 * Empty input stays "" (not "0").
 */
export function sanitizeDigitString(raw: string): string {
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned === "") return "";
  const noLeading = cleaned.replace(/^0+/, "");
  return noLeading === "" ? "" : noLeading;
}

/**
 * Sanitize decimal strings (rates): allows "8.5", "0.25", trailing "8." while typing.
 */
export function sanitizeDecimalString(raw: string): string {
  let s = raw.replace(/[^\d.]/g, "");
  if (s === "" || s === ".") return "";
  const firstDot = s.indexOf(".");
  if (firstDot === -1) {
    return sanitizeDigitString(s);
  }
  let intPart = s.slice(0, firstDot).replace(/\D/g, "");
  const fracPart = s.slice(firstDot + 1).replace(/\D/g, "").slice(0, 8);
  intPart = intPart.replace(/^0+/, "");
  if (intPart === "" && fracPart.length > 0) {
    intPart = "0";
  }
  if (fracPart.length > 0) {
    return `${intPart}.${fracPart}`;
  }
  // Trailing dot: "12." or "0." (typing decimals); lone "." already rejected
  if (intPart === "") {
    return "0.";
  }
  return `${intPart}.`;
}

/** Integer amounts / counts → number for API. Empty → 0. */
export function parseDigitsInt(raw: string): number {
  const s = sanitizeDigitString(raw);
  if (s === "") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? Math.min(n, Number.MAX_SAFE_INTEGER) : 0;
}

/** Rates / decimals → number for API. Empty / "." / "8." → 0 or partial value. */
export function parseDecimalInput(raw: string): number {
  const s = sanitizeDecimalString(raw);
  if (s === "" || s === ".") return 0;
  if (s.endsWith(".")) {
    const head = s.slice(0, -1);
    if (head === "") return 0;
    const n = parseFloat(head);
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function intStringFromNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.trunc(n));
}

export function decimalStringFromNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  const s = String(n);
  return sanitizeDecimalString(s);
}
