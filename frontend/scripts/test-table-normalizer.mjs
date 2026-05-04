/* eslint-disable */
// Standalone test for normalizeMarkdownForRender — mirrors src/lib/chatDisplay.ts.
// Run: node scripts/test-table-normalizer.mjs

function isTableRowLine(line) {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && (t.match(/\|/g)?.length ?? 0) >= 2;
}
function isTableSeparatorLine(line) {
  const t = line.trim();
  if (!t.startsWith("|") || !t.endsWith("|")) return false;
  return /^\|(?:[\s\-:]+\|)+$/.test(t);
}
function splitGluedTableRows(line) {
  if (!line.includes("||")) return [line];
  const trimmedStart = line.replace(/^\s+/, "");
  if (!trimmedStart.startsWith("|")) return [line];
  const parts = line.split(/\|\|/g);
  if (parts.length < 2) return [line];
  const out = [];
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
function splitProseFromInlineHeader(line, next) {
  if (!isTableSeparatorLine(next)) return [line];
  const trimmed = line.trim();
  if (trimmed.startsWith("|")) return [line];
  const m = line.match(/^(.*?)(\s*\|(?:[^|\n]+\|){2,})\s*$/);
  if (!m) return [line];
  const prose = m[1].trimEnd();
  const header = m[2].trim();
  if (!isTableRowLine(header)) return [line];
  if (prose.length === 0) return [header];
  return [prose, header];
}
function normalizeMarkdownForRender(text) {
  if (!text || !text.includes("|")) return text;
  const splitLines = [];
  for (const raw of text.split("\n")) {
    if (raw.includes("||") && raw.trim().startsWith("|")) {
      splitLines.push(...splitGluedTableRows(raw));
    } else {
      splitLines.push(raw);
    }
  }
  const splitLines2 = [];
  for (let i = 0; i < splitLines.length; i++) {
    const cur = splitLines[i];
    const next = splitLines[i + 1] ?? "";
    if (cur.includes("|") && !cur.trim().startsWith("|")) {
      splitLines2.push(...splitProseFromInlineHeader(cur, next));
    } else {
      splitLines2.push(cur);
    }
  }
  const out = [];
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function looksLikeParseableGFM(md) {
  // Conservative check: header row, then separator row on the next line,
  // and a blank line (or nothing) before the header row.
  const lines = md.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (isTableRowLine(lines[i]) && isTableSeparatorLine(lines[i + 1])) {
      const prev = i === 0 ? "" : lines[i - 1];
      if (prev === "" || prev.trim() === "") return true;
    }
  }
  return false;
}

let passed = 0;
let failed = 0;
function assert(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${extra ? "\n      " + extra : ""}`);
  }
}

// ── Test cases ──────────────────────────────────────────────────────────────
console.log("Table normalizer edge cases\n");

// 1. Glued separator + first body row (the original bug)
{
  const input = `Here's the picture:
| Detail | Value |
|---|---|| Your monthly income | ₹1,00,000 |
| Your savings | ₹65,000 |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "1. separator glued to first body row gets split",
    out.includes("|---|---|\n| Your monthly income"),
    JSON.stringify(out),
  );
  assert(
    "1b. blank line inserted before header",
    /Here's the picture:\n\n\| Detail \| Value \|/.test(out),
    JSON.stringify(out),
  );
  assert("1c. result is parseable as GFM table", looksLikeParseableGFM(out), JSON.stringify(out));
}

// 2. Whole table glued onto one or two physical lines
{
  const input = `Here are the numbers:
| A | B || --- | --- || row1 | val1 || row2 | val2 |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "2. multi-glued rows split into separate lines",
    out.split("\n").filter((l) => l.startsWith("|")).length === 4,
    JSON.stringify(out),
  );
  assert("2b. parseable", looksLikeParseableGFM(out), JSON.stringify(out));
}

// 3. Already correct table — must not be mangled
{
  const input = `Some prose

| Detail | Value |
| --- | --- |
| A | 1 |
| B | 2 |
`;
  const out = normalizeMarkdownForRender(input);
  assert("3. correct table is preserved unchanged", out.trim() === input.trim(), JSON.stringify(out));
}

// 4. Table without blank line before it
{
  const input = `Sentence ending.
| H1 | H2 |
| --- | --- |
| a | b |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "4. blank line inserted between prose and header",
    /Sentence ending\.\n\n\| H1 \| H2 \|/.test(out),
    JSON.stringify(out),
  );
}

// 5. Header on the SAME LINE as prose
{
  const input = `Sentence ending. | H1 | H2 |
| --- | --- |
| a | b |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "5. table on same line as prose is split off (parseable after fix)",
    looksLikeParseableGFM(out),
    JSON.stringify(out),
  );
}

// 6. Three-column table, glued separator+body
{
  const input = `Plan:
| Priority | Amount | Why |
| --- | --- | --- || Rent | ₹15,000 | Comfortable |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "6. 3-col table separator glued to body splits cleanly",
    out.includes("| --- | --- | --- |\n| Rent | ₹15,000 | Comfortable |"),
    JSON.stringify(out),
  );
  assert("6b. parseable", looksLikeParseableGFM(out), JSON.stringify(out));
}

// 7. Plain prose containing `||` should NOT be split
{
  const input = `Use the command \`a || b\` to fall back. No table here.`;
  const out = normalizeMarkdownForRender(input);
  assert("7. prose with || but no leading | is untouched", out === input, JSON.stringify(out));
}

// 8. Center / right alignment markers in separator
{
  const input = `Compare:
| Plan | Maturity |
| :--- | ---: |
| A | ₹1L |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "8. alignment markers (:---:, ---:) recognized as separator",
    looksLikeParseableGFM(out),
    JSON.stringify(out),
  );
}

// 9. Multiple tables in one message
{
  const input = `Compare loans:
| A | B |
| --- | --- |
| 1 | 2 |

Compare SIPs:
| C | D |
| --- | --- |
| 3 | 4 |`;
  const out = normalizeMarkdownForRender(input);
  const tables = out.split("\n").filter((l) => /^\|\s*-/.test(l.trim())).length;
  assert("9. both separator rows preserved", tables === 2, JSON.stringify(out));
}

// 10. Empty / no-pipe input
{
  assert("10a. empty string preserved", normalizeMarkdownForRender("") === "");
  assert("10b. plain prose preserved", normalizeMarkdownForRender("Hello.") === "Hello.");
}

// 11. Single-column table
{
  const input = `List:
| Item |
| --- |
| Coffee |`;
  const out = normalizeMarkdownForRender(input);
  assert("11. single-column table parseable", looksLikeParseableGFM(out), JSON.stringify(out));
}

// 12. Streaming chunk: separator only, no body yet — must not crash / corrupt
{
  const input = `Header coming:
| Det | Val |
| --- | --- |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "12. partial table without body is still well-formed",
    out.includes("| Det | Val |") && out.includes("| --- | --- |"),
    JSON.stringify(out),
  );
}

// 13. Cell containing colons or numbers (regex separator must not over-match)
{
  const input = `Notes:
| Field | Value |
| --- | --- |
| Score | 750:Good |
| Ratio | 1:2 |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "13. cells with colons not mis-detected as separator",
    looksLikeParseableGFM(out) && out.includes("| Score | 750:Good |"),
    JSON.stringify(out),
  );
}

// 14. Bold / inline markdown inside cells
{
  const input = `Notes:
| **Field** | _Value_ |
| --- | --- |
| **EMI** | \`₹86,782\` |`;
  const out = normalizeMarkdownForRender(input);
  assert(
    "14. inline markdown in cells preserved",
    out.includes("**Field**") && out.includes("`₹86,782`"),
    JSON.stringify(out),
  );
}

// 15. Idempotency — running normalizer twice gives same output
{
  const input = `Hi.
| A | B |
| --- | --- |
| 1 | 2 |`;
  const once = normalizeMarkdownForRender(input);
  const twice = normalizeMarkdownForRender(once);
  assert("15. idempotent (normalize twice == once)", once === twice);
}

// 16. Pipe in prose without table-like start should not split
{
  const input = `Run: \`grep foo || true\`. Done.`;
  const out = normalizeMarkdownForRender(input);
  assert("16. inline code with `||` untouched", out === input, JSON.stringify(out));
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
