export type ParsedMdTable = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string>>;
};

function isSeparator(line?: string) {
  if (!line) return false;
  const t = line.trim();
  if (!t.includes('-') || !t.includes('|')) return false;
  return t.replace(/[\s|:.-]/g, '').length === 0;
}

function isRow(line?: string) {
  if (!line) return false;
  const t = line.trim();
  return t.includes('|') && !isSeparator(t);
}

function splitRow(line: string) {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

/** Pull GFM tables out of markdown so they can be rendered as real HTML tables. */
export function extractMarkdownTables(content: string): { text: string; tables: ParsedMdTable[] } {
  if (!content) return { text: '', tables: [] };
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const tables: ParsedMdTable[] = [];
  const kept: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isRow(lines[i]) && isSeparator(lines[i + 1])) {
      const header = splitRow(lines[i]);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && isRow(lines[i])) {
        body.push(splitRow(lines[i]));
        i += 1;
      }
      const columns = header.map((label, idx) => ({
        key: `c${idx}`,
        label: label || `عمود ${idx + 1}`,
      }));
      tables.push({
        columns,
        rows: body.map((cells) => {
          const row: Record<string, string> = {};
          columns.forEach((col, idx) => {
            row[col.key] = cells[idx] || '';
          });
          return row;
        }),
      });
      continue;
    }
    kept.push(lines[i]);
    i += 1;
  }

  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), tables };
}

export function looksNumeric(value: unknown) {
  const t = String(value ?? '').replace(/[,$\s]|د\.ع|IQD|USD/gi, '');
  return t.length > 0 && /^-?\d+(\.\d+)?$/.test(t);
}
