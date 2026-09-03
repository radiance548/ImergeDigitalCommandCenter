import { NextResponse } from "next/server";
import { audienceService } from "@/lib/server/services/audienceService";
import { parseContactWorkbook } from "@/lib/server/contactFileParser";
import { apiError, withErrorHandling } from "@/lib/server/apiUtils";
import { requirePermission } from "@/lib/server/auth";

interface Params {
  params: { id: string };
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;
// Matches importContactsSchema's per-request cap (see validation.ts) — a
// parsed file over that size is sent to audienceService.importContacts in
// several chunked calls rather than one, same as the paste-based import.
const IMPORT_CHUNK_SIZE = 5000;

export const POST = withErrorHandling(async (req: Request, { params }: Params) => {
  const user = await requirePermission("marketing", "edit");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return apiError(400, "No file uploaded.");
  if (file.size > MAX_FILE_BYTES) {
    return apiError(400, `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)}MB).`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseContactWorkbook(buffer, file.name);
  } catch {
    return apiError(400, "Could not read that file — expected a .xlsx or .csv spreadsheet.");
  }

  let imported = 0;
  for (let i = 0; i < parsed.contacts.length; i += IMPORT_CHUNK_SIZE) {
    imported += await audienceService.importContacts(
      params.id,
      { contacts: parsed.contacts.slice(i, i + IMPORT_CHUNK_SIZE) },
      user.id
    );
  }

  return NextResponse.json({ imported, totalRows: parsed.totalRows, skipped: parsed.skipped });
});
