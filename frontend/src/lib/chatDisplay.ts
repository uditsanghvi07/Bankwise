/** Remove model-echoed widget tags so markdown does not show raw `<widget ...>`. */
export function stripAssistantWidgetMarkup(text: string): string {
  if (!text) return "";
  return text
    .replace(/<widget\b[\s\S]*?<\/widget>/gi, "")
    .replace(/<widget\b[^>]*\/>/gi, "")
    .replace(/<widget\b[^>]*$/gi, "");
}

function isTableRowLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && (t.match(/\|/g)?.length ?? 0) >= 2;
}

function isTableSeparatorLine(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return false;
  return /^\|(?:[\s\-:]+\|)+$/.test(t);
}

/**
 * Split a single physical line that contains 2+ glued table rows into
 * separate lines. Models often emit `|---|---|| Label | Value |` etc.
 * Heuristic: split on `||` between rows when the result still looks like
 * a valid pipe row on each side.
 */
function splitGluedTableRows(line: string): string[] {
  if (!line.includes("||")) return [line];
  const trimmedStart = line.replace(/^\s+/, "");
  if (!trimmedStart.startsWith("|")) return [line];
  const parts = line.split(/\|\|/g);
  if (parts.length < 2) return [line];
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    let chunk = parts[i];
    if (i > 0) chunk = "|" + chunk;
    if (i < parts.length - 1) chunk = chunk + "|";
    chunk = chunk.trim();
    if (chunk.length === 0) continue;
    if (!chunk.startsWith("|") || !chunk.endsWith("|")) return [line];
    out.push(chunk);
  }
  return out.length >= 2 ? out : [line];
}

/**
 * If a line contains prose followed by a pipe table header on the same
 * physical line (e.g. `Sentence ending. | H1 | H2 |`) AND the next line
 * looks like a GFM separator, split prose and header onto separate lines.
 */
function splitProseFromInlineHeader(line: string, next: string): string[] {
  if (!isTableSeparatorLine(next)) return [line];
  const trimmed = line.trim();
  if (trimmed.startsWith("|")) return [line]; // already on its own line
  // Find the LAST run that looks like `| ... | ... |` at the end of the line.
  const m = line.match(/^(.*?)(\s*\|(?:[^|\n]+\|){2,})\s*$/);
  if (!m) return [line];
  const prose = m[1].trimEnd();
  const header = m[2].trim();
  if (!isTableRowLine(header)) return [line];
  if (prose.length === 0) return [header];
  return [prose, header];
}

/**
 * Models often glue pipe-table rows together — e.g. drop the newline
 * between the alignment row and the first body row, or run the whole
 * table on a couple of lines. Also, GFM tables need a blank line before
 * them or remark-gfm won't parse. This function fixes all three cases.
 */
export function normalizeMarkdownForRender(text: string): string {
  if (!text || !text.includes("|")) return text;

  // 1) Split lines that contain multiple `|...|` rows joined by `||`.
  const splitLines: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.includes("||") && raw.trim().startsWith("|")) {
      splitLines.push(...splitGluedTableRows(raw));
    } else {
      splitLines.push(raw);
    }
  }

  // 2) Split prose-glued-to-header on the same physical line.
  const splitLines2: string[] = [];
  for (let i = 0; i < splitLines.length; i++) {
    const cur = splitLines[i];
    const next = splitLines[i + 1] ?? "";
    if (cur.includes("|") && !cur.trim().startsWith("|")) {
      splitLines2.push(...splitProseFromInlineHeader(cur, next));
    } else {
      splitLines2.push(cur);
    }
  }

  // 3) Walk lines: when we see a row whose next line is a separator,
  //    insert a blank line before it (so GFM parses the table).
  const out: string[] = [];
  for (let i = 0; i < splitLines2.length; i++) {
    const line = splitLines2[i];
    const next = splitLines2[i + 1] ?? "";
    if (isTableRowLine(line) && isTableSeparatorLine(next) && out.length > 0) {
      const prev = out[out.length - 1];
      if (prev.trim() !== "" && !isTableRowLine(prev) && !isTableSeparatorLine(prev)) {
        out.push("");
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Banking / finance abbreviation dictionary.
 * Key   = exact abbreviation as it appears in text (case-sensitive match via \b).
 * Value = full form shown in parentheses on FIRST occurrence per message.
 */
const ABBR_MAP: Record<string, string> = {
  FOIR:  "Fixed Obligations to Income Ratio",
  EMI:   "Equated Monthly Instalment",
  SIP:   "Systematic Investment Plan",
  FD:    "Fixed Deposit",
  RD:    "Recurring Deposit",
  CIBIL: "Credit Information Bureau India Limited",
  LTV:   "Loan-to-Value",
  LTI:   "Loan-to-Income",
  NACH:  "National Automated Clearing House",
  PMAY:  "Pradhan Mantri Awas Yojana",
  NPA:   "Non-Performing Asset",
  NBFC:  "Non-Banking Financial Company",
  EPF:   "Employees' Provident Fund",
  PPF:   "Public Provident Fund",
  ELSS:  "Equity Linked Savings Scheme",
  TDS:   "Tax Deducted at Source",
  ITR:   "Income Tax Return",
  GST:   "Goods and Services Tax",
  KYC:   "Know Your Customer",
  AML:   "Anti-Money Laundering",
  MF:    "Mutual Fund",
  NAV:   "Net Asset Value",
  AMC:   "Asset Management Company",
  SEBI:  "Securities and Exchange Board of India",
  RBI:   "Reserve Bank of India",
  NEFT:  "National Electronic Funds Transfer",
  RTGS:  "Real Time Gross Settlement",
  IMPS:  "Immediate Payment Service",
  UPI:   "Unified Payments Interface",
  MCLR:  "Marginal Cost of funds-based Lending Rate",
  RLLR:  "Repo-Linked Lending Rate",
  CAGR:  "Compounded Annual Growth Rate",
  XIRR:  "Extended Internal Rate of Return",
  ECS:   "Electronic Clearing Service",
};

/**
 * On the first occurrence of each known abbreviation in the message,
 * append "(Full Form)" immediately after it.
 *
 * Works on plain text AND inside markdown — avoids double-expanding
 * by tracking which abbreviations have already been expanded.
 *
 * Skips abbreviations that already have a parenthetical explanation
 * right after them, e.g. "FOIR (…" won't be touched again.
 */
export function expandAbbreviations(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [abbr, fullForm] of Object.entries(ABBR_MAP)) {
    // Match the abbreviation as a whole word NOT already followed by "("
    const re = new RegExp(`\\b${abbr}\\b(?!\\s*\\()`, "g");
    let replaced = false;
    result = result.replace(re, (match) => {
      if (replaced) return match; // only first occurrence
      replaced = true;
      return `${match} (${fullForm})`;
    });
  }
  return result;
}
