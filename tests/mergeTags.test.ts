import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { renderMergeTags } from "../src/lib/server/mergeTags";

describe("mergeTags: campaign personalization", () => {
  test("substitutes a known tag", () => {
    assert.equal(renderMergeTags("Hi {{first_name}}!", { first_name: "Ada" }), "Hi Ada!");
  });

  test("substitutes multiple tags", () => {
    const result = renderMergeTags("{{first_name}} {{last_name}} <{{email}}>", {
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
    });
    assert.equal(result, "Ada Lovelace <ada@example.com>");
  });

  test("unknown tags render as empty string, not left literal or throwing", () => {
    assert.equal(renderMergeTags("Hi {{nonexistent}}!", {}), "Hi !");
  });

  test("null/undefined values render as empty string", () => {
    assert.equal(renderMergeTags("{{a}}{{b}}", { a: null, b: undefined }), "");
  });

  test("tolerates whitespace inside the braces", () => {
    assert.equal(renderMergeTags("{{ first_name }}", { first_name: "Ada" }), "Ada");
  });

  test("leaves non-tag text and surrounding HTML untouched", () => {
    const html = "<p>Hi {{first_name}}, thanks!</p>";
    assert.equal(renderMergeTags(html, { first_name: "Kofi" }), "<p>Hi Kofi, thanks!</p>");
  });

  test("coerces non-string values (numbers/booleans) to strings", () => {
    assert.equal(renderMergeTags("Count: {{n}}", { n: 42 }), "Count: 42");
  });

  test("does not choke on malicious-looking but ultimately inert input", () => {
    // Merge tags are substituted, not evaluated — this should not execute anything,
    // just substitute the literal string value.
    const result = renderMergeTags("{{payload}}", { payload: "<script>alert(1)</script>" });
    assert.equal(result, "<script>alert(1)</script>");
  });
});
