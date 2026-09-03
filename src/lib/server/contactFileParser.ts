import { Readable } from "node:stream";
import ExcelJS from "exceljs";

export interface ParsedContact {
  email: string;
  firstName?: string;
  lastName?: string;
  attributes?: Record<string, unknown>;
}

export interface ParsedWorkbook {
  contacts: ParsedContact[];
  totalRows: number;
  skipped: number;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

/**
 * Collapses duplicate emails (case-insensitive), keeping the last
 * occurrence. Postgres's `ON CONFLICT DO UPDATE` errors outright if the
 * same conflict key appears twice within one multi-row INSERT statement
 * ("cannot affect row a second time") — real source spreadsheets can and
 * do contain repeated emails, so callers building a bulk upsert from
 * user-supplied contacts (see audienceService.importContacts) must dedupe
 * first.
 */
export function dedupeContactsByEmail<T extends { email: string }>(contacts: T[]): T[] {
  return [...new Map(contacts.map((c) => [c.email.toLowerCase(), c])).values()];
}

const TITLE_PATTERN = /^(mr|mrs|miss|ms|dr|chief|engr|prince|princess|alhaji|hajia|pastor|rev|barr|prof)\.?\s+/i;

/**
 * Splits a single "Name" column into firstName/lastName. Strips a title —
 * trailing in parentheses ("Ogar Vivian (Mrs)") or leading ("Miss Tayo",
 * "Dr Zamba Yomi") — since a title is neither name and, left in place,
 * would land in firstName/lastName exactly where {{first_name}}-style
 * merge tags (see ContentStep) pull from, producing "Hi Miss," instead of
 * "Hi Tayo,". Real source data mixes both styles (measured directly
 * against the spreadsheet this was built for: ~48% trailing-parenthetical,
 * ~6% leading), so both are stripped, in either order, before splitting.
 * First remaining whitespace-separated token becomes firstName, the rest
 * becomes lastName — an imperfect heuristic for non-Western name orders,
 * but consistent with how the existing paste-based "email, First, Last"
 * import already treats names.
 */
function splitFullName(fullName: string): { firstName?: string; lastName?: string } {
  let stripped = fullName.trim();
  stripped = stripped.replace(/\s*\([^)]*\)\s*$/, "").trim();
  stripped = stripped.replace(TITLE_PATTERN, "").trim();
  if (!stripped) return {};
  const [firstName, ...rest] = stripped.split(/\s+/);
  const lastName = rest.join(" ");
  return { firstName, lastName: lastName || undefined };
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("richText" in value) return (value.richText as { text: string }[]).map((r) => r.text).join("");
    if ("text" in value) return String((value as { text: unknown }).text ?? "");
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
  }
  return String(value);
}

/**
 * Parses an uploaded contacts spreadsheet (.xlsx or .csv) into the same
 * shape the paste-based import already produces. Recognizes a header row
 * with any of: Email (or "Email Address"), Name (or "Full Name") OR
 * separate "First Name"/"Last Name" columns, and an optional Phone (or
 * "Phone Number") column — matching the real export format this was built
 * against (Name, Email, Phone).
 */
export async function parseContactWorkbook(buffer: Buffer, filename: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  if (filename.toLowerCase().endsWith(".csv")) {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { contacts: [], totalRows: 0, skipped: 0 };

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = normalizeKey(cellText(cell.value));
  });

  const contacts: ParsedContact[] = [];
  let totalRows = 0;
  let skipped = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;

    const values: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (key) values[key] = cellText(cell.value).trim();
    });
    if (!Object.values(values).some(Boolean)) continue; // fully blank row

    totalRows++;

    const email = (values.email || values["email address"] || "").toLowerCase();
    if (!email.includes("@")) {
      skipped++;
      continue;
    }

    let firstName: string | undefined;
    let lastName: string | undefined;
    if (values["first name"] || values["last name"]) {
      firstName = values["first name"] || undefined;
      lastName = values["last name"] || undefined;
    } else if (values.name || values["full name"]) {
      ({ firstName, lastName } = splitFullName(values.name || values["full name"]));
    }

    const phone = values.phone || values["phone number"];
    const attributes = phone ? { phone } : undefined;

    contacts.push({ email, firstName, lastName, attributes });
  }

  return { contacts, totalRows, skipped };
}
