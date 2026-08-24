"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentType } from "react";

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
    typeof window !== "undefined" ? getComputedStyle(document.documentElement).getPropertyValue("--text") : "#f5f5f7";
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: textColor },
    margin: { t: 36, r: 18, b: 42, l: 52 },
    legend: { orientation: "h", y: -0.2 },
  };
}

export default function PlotlyChart({ id, data, layout, onGraphDiv, onPointClick }: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Dashboards can stack 6-7 of these; each is a genuinely heavy Plotly
  // instance to initialize (SVG construction + layout calc), so mounting
  // them all immediately on navigation is a real, felt delay even though
  // the plotly.js chunk itself is cached after first load. Deferring
  // mount until a chart actually scrolls near the viewport spreads that
  // cost out instead of paying all of it up front.
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: 300 }}>
      {isNearViewport && (
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
      )}
    </div>
  );
}
