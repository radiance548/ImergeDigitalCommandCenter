import { sanitizeFileName } from "./utils";

/** Minimal shape of a Plotly graph div we rely on for exports. */
export interface PlotlyGraphDiv extends HTMLElement {
  data?: any[];
}

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function rowsToCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(",")),
  ].join("\n");
}

export function downloadRowsAsCSV(rows: Record<string, unknown>[], filename: string) {
  const csv = rowsToCSV(rows);
  if (!csv) {
    alert("No data to export.");
    return;
  }
  downloadBlob(csv, "text/csv;charset=utf-8", filename);
}

/** Flattens a Plotly figure's traces into tabular rows, per original app logic. */
export function chartRowsFromPlotly(chart: PlotlyGraphDiv): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const traces = chart.data || [];

  traces.forEach((trace: any, traceIndex: number) => {
    const traceName = trace.name || trace.label || trace.type || `Series ${traceIndex + 1}`;

    if (trace.type === "pie") {
      const labels = trace.labels || [];
      const values = trace.values || [];
      labels.forEach((label: string, i: number) => {
        rows.push({ chart: chart.id, series: traceName, label, value: values[i] ?? "" });
      });
      return;
    }

    if (trace.type === "funnel") {
      const y = trace.y || [];
      const x = trace.x || [];
      y.forEach((stage: string, i: number) => {
        rows.push({ chart: chart.id, series: traceName, label: stage, value: x[i] ?? "" });
      });
      return;
    }

    if (trace.type === "waterfall") {
      const x = trace.x || [];
      const y = trace.y || [];
      x.forEach((label: string, i: number) => {
        rows.push({ chart: chart.id, series: traceName, label, value: y[i] ?? "" });
      });
      return;
    }

    if (trace.type === "heatmap") {
      const x = trace.x || [];
      const y = trace.y || [];
      const z = trace.z || [];
      z.forEach((row: number[], rowIndex: number) => {
        row.forEach((value, colIndex) => {
          rows.push({ chart: chart.id, series: traceName, x: x[colIndex] ?? colIndex, y: y[rowIndex] ?? rowIndex, value });
        });
      });
      return;
    }

    const x = trace.x || [];
    const y = trace.y || [];
    const text = trace.text || [];
    const maxLen = Math.max(x.length, y.length, text.length);
    for (let i = 0; i < maxLen; i++) {
      rows.push({ chart: chart.id, series: traceName, x: x[i] ?? "", y: y[i] ?? "", label: text[i] ?? "" });
    }
  });

  return rows;
}

export function downloadChartCSV(chart: PlotlyGraphDiv) {
  const rows = chartRowsFromPlotly(chart);
  if (!rows.length) {
    alert("No chart data to export.");
    return;
  }
  downloadRowsAsCSV(rows, `${sanitizeFileName(chart.id)}-chart-data.csv`);
}

export async function downloadChartImage(chart: PlotlyGraphDiv, format: "png" | "svg" = "png") {
  try {
    const Plotly = (await import("plotly.js-dist-min")).default;
    const url = await Plotly.toImage(chart as any, {
      format,
      width: 1200,
      height: 800,
      scale: format === "png" ? 2 : 1,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFileName(chart.id)}.${format}`;
    a.click();
  } catch (error) {
    console.error(error);
    alert("Could not export this chart image. Try PNG if SVG fails.");
  }
}

export async function downloadChartPDF(chart: PlotlyGraphDiv) {
  try {
    const Plotly = (await import("plotly.js-dist-min")).default;
    const image = await Plotly.toImage(chart as any, { format: "png", width: 1400, height: 900, scale: 2 });
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF("landscape", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    pdf.setFontSize(14);
    pdf.text(`${chart.id} chart`, margin, 12);
    pdf.addImage(image, "PNG", margin, 18, pageW - margin * 2, pageH - 28);
    pdf.save(`${sanitizeFileName(chart.id)}-chart.pdf`);
  } catch (error) {
    console.error(error);
    alert("Could not export chart PDF.");
  }
}

export async function exportDashboardPDF(target: HTMLElement, routeName: string) {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const canvas = await html2canvas(target, { scale: 2, backgroundColor: null });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF("landscape", "mm", "a4");
  const w = pdf.internal.pageSize.getWidth();
  const h = (canvas.height * w) / canvas.width;
  pdf.addImage(img, "PNG", 0, 0, w, Math.min(h, pdf.internal.pageSize.getHeight()));
  pdf.save(`${routeName}-dashboard.pdf`);
}
