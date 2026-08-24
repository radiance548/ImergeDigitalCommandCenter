"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export interface PlotlyPoint {
  x?: unknown;
  y?: unknown;
  label?: unknown;
}

interface PlotlyChartProps {
  id: string;
  data: unknown[];
  layout?: Record<string, unknown>;
  onGraphDiv?: (div: HTMLElement) => void;
  onPointClick?: (point: PlotlyPoint) => void;
}

// Loaded client-side only, combining the lightweight plotly.js-dist-min
// bundle with react-plotly.js's factory (avoids pulling in the full
// plotly.js package just for the React wrapper).
const Plot = dynamic(
  () =>
    Promise.all([import("plotly.js-dist-min"), import("react-plotly.js/factory")]).then(
      ([Plotly, factory]) => ({ default: factory.default(Plotly.default) as ComponentType<any> })
    ),
  { ssr: false, loading: () => <div style={{ minHeight: 300 }} /> }
);

function defaultLayout(): Record<string, unknown> {
  const textColor =
    typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--text") : "#182230";
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: textColor },
    margin: { t: 36, r: 18, b: 42, l: 52 },
    legend: { orientation: "h", y: -0.2 },
  };
}

export default function PlotlyChart({ id, data, layout, onGraphDiv, onPointClick }: PlotlyChartProps) {
  return (
    <Plot
      divId={id}
      data={data}
      layout={{ ...defaultLayout(), ...layout }}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%", height: "100%", minHeight: 300 }}
      useResizeHandler
      onInitialized={(_figure: unknown, graphDiv: HTMLElement) => onGraphDiv?.(graphDiv)}
      onUpdate={(_figure: unknown, graphDiv: HTMLElement) => onGraphDiv?.(graphDiv)}
      onClick={(e: any) => {
        const p = e?.points?.[0];
        if (p) onPointClick?.(p);
      }}
    />
  );
}
