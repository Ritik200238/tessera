/**
 * Minimal CSV export helper. Quotes per RFC 4180.
 */

export interface CsvColumn<Row> {
  key: keyof Row & string;
  header: string;
  format?: (value: Row[keyof Row], row: Row) => string;
}

export function rowsToCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const head = columns.map((c) => quote(c.header)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const raw = (r as unknown as Record<string, unknown>)[c.key];
          const v = c.format ? c.format(raw as Row[keyof Row], r) : raw;
          return quote(v === null || v === undefined ? "" : String(v));
        })
        .join(","),
    )
    .join("\n");
  return `${head}\n${body}\n`;
}

function quote(s: string): string {
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Browser-side download trigger. Returns the created object URL so the
 * caller can revoke it once the browser finishes consuming.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has time to fetch the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
