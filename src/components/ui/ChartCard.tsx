"use client";

import { useRef } from "react";
import PlotlyChart, { type PlotlyPoint } from "@/components/charts/PlotlyChart";
import { downloadChartCSV, downloadChartImage, downloadChartPDF, type PlotlyGraphDiv } from "@/lib/exportUtils";
import { useAppStore } from "@/store/useAppStore";
import type { DashboardId } from "@/lib/types";

interface ChartCardProps {
  id: string;
  title: string;
  dashboard: DashboardId;
  span?: number;
  data: unknown[];
  layout?: Record<string, unknown>;
  onPointClick?: (point: PlotlyPoint) => void;
}

export default function ChartCard({ id, title, dashboard, span = 6, data, layout, onPointClick }: ChartCardProps) {
  const canExport = useAppStore((s) => s.canExport(dashboard));
  const graphDivRef = useRef<PlotlyGraphDiv | null>(null);

  return (
    <div className={`chart-card span-${span}`} data-chart-card={id}>
      <div className="chart-card-header">
        <h3>{title}</h3>
        {canExport && (
          <div className="chart-card-actions">
            <button className="btn" onClick={() => graphDivRef.current && downloadChartCSV(graphDivRef.current)}>
              <i className="fa-solid fa-file-csv" /> CSV
            </button>
            <button className="btn" onClick={() => graphDivRef.current && downloadChartImage(graphDivRef.current, "png")}>
              <i className="fa-solid fa-image" /> PNG
            </button>
            <button className="btn" onClick={() => graphDivRef.current && downloadChartImage(graphDivRef.current, "svg")}>
              SVG
            </button>
            <button className="btn" onClick={() => graphDivRef.current && downloadChartPDF(graphDivRef.current)}>
              <i className="fa-solid fa-file-pdf" /> PDF
            </button>
          </div>
        )}
      </div>
      <div className="plot">
        <PlotlyChart
          id={id}
          data={data}
          layout={layout}
          onGraphDiv={(div) => {
            graphDivRef.current = div as PlotlyGraphDiv;
          }}
          onPointClick={onPointClick}
        />
      </div>
    </div>
  );
}
