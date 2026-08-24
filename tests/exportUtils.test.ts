import assert from "node:assert/strict";
import { describe, test } from "./harness";
import { rowsToCSV, chartRowsFromPlotly, type PlotlyGraphDiv } from "../src/lib/exportUtils";

describe("exportUtils: rowsToCSV", () => {
  test("returns an empty string for no rows", () => {
    assert.equal(rowsToCSV([]), "");
  });

  test("produces a header row from the union of all keys", () => {
    const csv = rowsToCSV([{ a: 1, b: 2 }, { a: 3, c: 4 }]);
    const [header] = csv.split("\n");
    assert.ok(header.includes("a"));
    assert.ok(header.includes("b"));
    assert.ok(header.includes("c"));
  });

  test("quotes values and escapes embedded quotes", () => {
    const csv = rowsToCSV([{ note: 'He said "hi"' }]);
    assert.ok(csv.includes('"He said ""hi"""'));
  });

  test("fills missing keys with empty strings rather than misaligning columns", () => {
    const csv = rowsToCSV([{ a: 1, b: 2 }, { a: 3 }]);
    const lines = csv.split("\n");
    // header + 2 data rows, and every row should have the same number of commas
    const commaCounts = lines.map((l) => (l.match(/,/g) || []).length);
    assert.equal(new Set(commaCounts).size, 1);
  });
});

describe("exportUtils: chartRowsFromPlotly", () => {
  function fakeGraphDiv(data: unknown[]): PlotlyGraphDiv {
    return { id: "test-chart", data } as unknown as PlotlyGraphDiv;
  }

  test("flattens a simple xy scatter/bar trace", () => {
    const chart = fakeGraphDiv([{ type: "bar", name: "Revenue", x: ["Jan", "Feb"], y: [100, 200] }]);
    const rows = chartRowsFromPlotly(chart);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].x, "Jan");
    assert.equal(rows[0].y, 100);
    assert.equal(rows[0].series, "Revenue");
  });

  test("flattens a pie trace into label/value rows", () => {
    const chart = fakeGraphDiv([{ type: "pie", labels: ["A", "B"], values: [10, 20] }]);
    const rows = chartRowsFromPlotly(chart);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].label, "A");
    assert.equal(rows[0].value, 10);
  });

  test("flattens a funnel trace", () => {
    const chart = fakeGraphDiv([{ type: "funnel", y: ["Leads", "Customers"], x: [100, 20] }]);
    const rows = chartRowsFromPlotly(chart);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].label, "Customers");
    assert.equal(rows[1].value, 20);
  });

  test("flattens a heatmap trace into per-cell rows", () => {
    const chart = fakeGraphDiv([
      { type: "heatmap", x: ["Mon", "Tue"], y: ["AM"], z: [[1, 2]] },
    ]);
    const rows = chartRowsFromPlotly(chart);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].x, "Mon");
    assert.equal(rows[0].value, 1);
  });

  test("handles multiple traces in one chart", () => {
    const chart = fakeGraphDiv([
      { type: "bar", name: "Income", x: ["Jan"], y: [500] },
      { type: "bar", name: "Expense", x: ["Jan"], y: [300] },
    ]);
    const rows = chartRowsFromPlotly(chart);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((r) => r.series),
      ["Income", "Expense"]
    );
  });

  test("returns an empty array for a chart with no data", () => {
    assert.deepEqual(chartRowsFromPlotly(fakeGraphDiv([])), []);
  });
});
