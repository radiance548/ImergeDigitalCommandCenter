"use client";

import { useMemo } from "react";
import FilterBar from "@/components/ui/FilterBar";
import KpiGrid from "@/components/ui/KpiGrid";
import ChartCard from "@/components/ui/ChartCard";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useSyncExportRows } from "@/hooks/useSyncExportRows";
import { useMoney } from "@/hooks/useMoney";
import { pct, sum } from "@/lib/utils";
import type { Deal } from "@/lib/types";

const STAGES = ["Proposal", "Negotiation", "Closed Won", "Closed Lost"];
const ROLES = ["SEO", "PPC", "Design", "Web", "Content"];

export default function PipelineView() {
  const data = useAppStore((s) => s.data);
  const canEdit = useAppStore((s) => s.canEdit("pipeline"));
  const deleteRecord = useAppStore((s) => s.deleteRecord);
  const advanceDealStage = useAppStore((s) => s.advanceDealStage);
  const simulateHire = useAppStore((s) => s.simulateHire);
  const openModal = useUIStore((s) => s.openModal);
  const money = useMoney();

  const { range, setRange, filterValues, setFilterValue, visualFilters, addVisualFilter, removeVisualFilter, clearVisualFilters } =
    useDashboardFilters();

  const records = useMemo(() => {
    let recs: Deal[] = [...(data?.deals || [])];
    if (filterValues.stage) recs = recs.filter((r) => r.stage === filterValues.stage);
    if (filterValues.role) recs = recs.filter((r) => r.requiredRole === filterValues.role);
    if (visualFilters.stage) recs = recs.filter((r) => r.stage === visualFilters.stage);
    return recs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterValues, visualFilters]);

  useSyncExportRows(records);

  const team = data?.team || [];
  const weighted = sum(records, (d) => (d.value * d.probability) / 100);
  const required = sum(records.filter((d) => d.stage !== "Closed Lost"), "hoursNeeded");
  const available = sum(team, "availableHoursThisMonth");
  const utilization = (required / Math.max(available, 1)) * 100;

  const pipelineTrend = useMemo(
    () => Array.from({ length: 6 }, (_, i) => sum(records, (d) => (d.value * d.probability) / 100) * (0.7 + i * 0.07)),
    [records]
  );

  if (!data) return null;

  return (
    <>
      <FilterBar
        range={range}
        onRangeChange={setRange}
        filters={[
          { key: "stage", label: "Deal Stage", options: STAGES },
          { key: "role", label: "Required Role", options: ROLES },
        ]}
        values={filterValues}
        onFilterChange={setFilterValue}
        visualFilters={visualFilters}
        onRemoveVisualFilter={removeVisualFilter}
        onClearVisualFilters={clearVisualFilters}
      />
      <KpiGrid
        items={[
          { label: "Weighted Pipeline", value: money(weighted) },
          { label: "Quarter Goal Coverage", value: pct((weighted / 100000) * 100) },
          { label: "Utilization Rate", value: pct(utilization) },
          { label: "Capacity Status", value: required > available ? "Over" : "Healthy" },
        ]}
      />
      <div className="chart-grid">
        <ChartCard
          id="dealFunnel"
          title="Deal Stage Funnel"
          dashboard="pipeline"
          span={5}
          data={[{ type: "funnel", y: STAGES, x: STAGES.map((s) => sum(records.filter((d) => d.stage === s), "value")) }]}
          onPointClick={(p) => (p.label || p.y) && addVisualFilter("stage", String(p.label ?? p.y))}
        />
        <ChartCard
          id="dealGantt"
          title="Deals by Expected Close"
          dashboard="pipeline"
          span={7}
          data={[{ x: records.map((d) => d.hoursNeeded), y: records.map((d) => d.clientName), type: "bar", orientation: "h" }]}
        />
        <ChartCard
          id="capacity"
          title="Required Hours vs Available"
          dashboard="pipeline"
          span={6}
          layout={{ barmode: "group" }}
          data={[
            { x: team.map((t) => t.role), y: team.map((t) => sum(records.filter((d) => d.requiredRole === t.role), "hoursNeeded")), name: "Required", type: "bar" },
            { x: team.map((t) => t.role), y: team.map((t) => t.availableHoursThisMonth), name: "Available", type: "bar" },
          ]}
        />
        <ChartCard
          id="pipelineTrend"
          title="Weighted Pipeline Trend"
          dashboard="pipeline"
          span={6}
          data={[{ x: ["W1", "W2", "W3", "W4", "W5", "W6"], y: pipelineTrend, type: "scatter", mode: "lines+markers" }]}
        />
        <div className="table-card span-12">
          <h3>Open Deals</h3>
          {canEdit ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn primary" onClick={() => openModal("addDeal")}>
                Add deal
              </button>
              <button className="btn success" onClick={() => simulateHire()}>
                Simulate hire
              </button>
            </div>
          ) : (
            <span className="badge">View only</span>
          )}
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Role</th>
                <th>Hours</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((d) => (
                <tr key={d.id}>
                  <td>{d.clientName}</td>
                  <td>{money(d.value)}</td>
                  <td>{d.stage}</td>
                  <td>{d.requiredRole}</td>
                  <td>{d.hoursNeeded}</td>
                  <td>
                    {canEdit ? (
                      <>
                        <button className="btn" onClick={() => advanceDealStage(d.id)}>
                          Advance
                        </button>{" "}
                        <button className="btn danger" onClick={() => deleteRecord("deals", d.id)}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="badge">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
