import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { describe, test } from "./harness";
import { dedupeContactsByEmail, parseContactWorkbook } from "../src/lib/server/contactFileParser";

async function buildWorkbookBuffer(headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("contactFileParser: parseContactWorkbook", () => {
  test("parses Name/Email/Phone columns, splitting Name into firstName/lastName", async () => {
    const buffer = await buildWorkbookBuffer(
      ["Name", "Email", "Phone"],
      [["Ada Lovelace", "ada@example.com", 8179741451]]
    );
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts.length, 1);
    assert.deepEqual(result.contacts[0], {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      attributes: { phone: "8179741451" },
    });
  });

  test("strips a trailing parenthetical title before splitting the name", async () => {
    const buffer = await buildWorkbookBuffer(["Name", "Email"], [["Ogar Vivian (Mrs)", "ogar@example.com"]]);
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts[0].firstName, "Ogar");
    assert.equal(result.contacts[0].lastName, "Vivian");
  });

  test("strips a leading title before splitting the name", async () => {
    const buffer = await buildWorkbookBuffer(["Name", "Email"], [["Dr Zamba Yomi", "zamba@example.com"]]);
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts[0].firstName, "Zamba");
    assert.equal(result.contacts[0].lastName, "Yomi");
  });

  test("strips both a leading and a trailing title on the same name", async () => {
    const buffer = await buildWorkbookBuffer(["Name", "Email"], [["Chief Ugo (Mr)", "ugo@example.com"]]);
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts[0].firstName, "Ugo");
    assert.equal(result.contacts[0].lastName, undefined);
  });

  test("prefers separate First Name/Last Name columns over a Name column when both are present", async () => {
    const buffer = await buildWorkbookBuffer(
      ["First Name", "Last Name", "Email"],
      [["Kofi", "Mensah", "kofi@example.com"]]
    );
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts[0].firstName, "Kofi");
    assert.equal(result.contacts[0].lastName, "Mensah");
  });

  test("header matching is case-insensitive", async () => {
    const buffer = await buildWorkbookBuffer(["NAME", "EMAIL"], [["Bo Diddley", "bo@example.com"]]);
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts.length, 1);
    assert.equal(result.contacts[0].email, "bo@example.com");
  });

  test("skips rows with no valid email and counts them separately from total rows", async () => {
    const buffer = await buildWorkbookBuffer(
      ["Name", "Email"],
      [
        ["Has Email", "hasemail@example.com"],
        ["No Email", ""],
        ["Bad Email", "not-an-email"],
      ]
    );
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.totalRows, 3);
    assert.equal(result.skipped, 2);
    assert.equal(result.contacts.length, 1);
  });

  test("ignores fully blank rows entirely (not counted in totalRows or skipped)", async () => {
    const buffer = await buildWorkbookBuffer(
      ["Name", "Email"],
      [
        ["Has Email", "hasemail@example.com"],
        ["", ""],
      ]
    );
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.totalRows, 1);
    assert.equal(result.skipped, 0);
  });

  test("lowercases emails", async () => {
    const buffer = await buildWorkbookBuffer(["Name", "Email"], [["Cap Case", "MixedCase@Example.COM"]]);
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts[0].email, "mixedcase@example.com");
  });

  test("omits attributes entirely when no phone is present", async () => {
    const buffer = await buildWorkbookBuffer(["Name", "Email"], [["No Phone", "nophone@example.com"]]);
    const result = await parseContactWorkbook(buffer, "test.xlsx");

    assert.equal(result.contacts[0].attributes, undefined);
  });
});

describe("contactFileParser: dedupeContactsByEmail", () => {
  test("collapses duplicate emails (case-insensitive), keeping the last occurrence", () => {
    const result = dedupeContactsByEmail([
      { email: "dup@example.com", firstName: "First" },
      { email: "unique@example.com", firstName: "Solo" },
      { email: "DUP@example.com", firstName: "Second" },
    ]);

    assert.equal(result.length, 2);
    const dup = result.find((c) => c.email.toLowerCase() === "dup@example.com");
    assert.equal(dup?.firstName, "Second");
  });

  test("leaves an all-unique list unchanged in content and order", () => {
    const input = [{ email: "a@example.com" }, { email: "b@example.com" }, { email: "c@example.com" }];
    const result = dedupeContactsByEmail(input);

    assert.deepEqual(
      result.map((c) => c.email),
      ["a@example.com", "b@example.com", "c@example.com"]
    );
  });
});
