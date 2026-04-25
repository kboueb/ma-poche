import Papa from "papaparse";

export interface ParsedRow {
  date: string;
  amount: number;
  description: string;
  flow: "income" | "expense";
}

export interface CSVMapping {
  dateCol: number;
  amountCol: number;
  descCol: number;
  creditCol?: number; // If separate credit/debit columns
}

/** Detect separator and parse CSV text */
export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  // Detect separator
  const firstLine = text.split("\n")[0] || "";
  const sep = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

  const result = Papa.parse<string[]>(text, {
    delimiter: sep,
    skipEmptyLines: true,
  });

  const data = result.data;
  if (data.length < 2) return { headers: [], rows: [] };

  return {
    headers: data[0],
    rows: data.slice(1),
  };
}

/** Apply column mapping to parsed rows */
export function applyMapping(rows: string[][], mapping: CSVMapping): ParsedRow[] {
  return rows
    .map((row) => {
      const rawDate = row[mapping.dateCol]?.trim() || "";
      const rawAmount = row[mapping.amountCol]?.trim().replace(/\s/g, "").replace(",", ".") || "0";
      const description = row[mapping.descCol]?.trim() || "";

      let amount = parseFloat(rawAmount);
      let flow: "income" | "expense" = "expense";

      // Handle separate credit column
      if (mapping.creditCol !== undefined) {
        const credit = parseFloat(row[mapping.creditCol]?.trim().replace(/\s/g, "").replace(",", ".") || "0");
        if (credit > 0) {
          amount = credit;
          flow = "income";
        } else {
          amount = Math.abs(amount);
          flow = "expense";
        }
      } else {
        // Single amount column: positive = income, negative = expense
        flow = amount >= 0 ? "income" : "expense";
        amount = Math.abs(amount);
      }

      // Parse date (try common formats)
      const date = parseDate(rawDate);

      return { date, amount, description, flow };
    })
    .filter((r) => r.amount > 0 && r.date);
}

function parseDate(raw: string): string {
  // Try DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  // Try YYYY-MM-DD
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  // Try MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})[/](\d{1,2})[/](\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;

  return "";
}

/** Deduplicate against existing transactions */
export function dedup(
  parsed: ParsedRow[],
  existing: Array<{ date: string; amount: number; description: string | null }>
): ParsedRow[] {
  const existingKeys = new Set(
    existing.map((t) => `${t.date}|${t.amount}|${(t.description || "").toLowerCase()}`)
  );
  return parsed.filter(
    (r) => !existingKeys.has(`${r.date}|${r.amount}|${r.description.toLowerCase()}`)
  );
}
