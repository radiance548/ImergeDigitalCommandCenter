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
import { pct, rand, sum } from "@/lib/utils";
import type { ClientRecord } from "@/lib/types";

const TIERS = ["A", "B", "C"];
const SERVICES = ["SEO", "PPC", "Design", "Web", "Content"];

export default function ClientsView() {
  const data = useAppStore((s) => s.data);
  const canEdit = useAppStore((s) => s.canEdit("clients"));
  const openModal = useUIStore((s) => s.openModal);
  const money = useMoney();

  const { range, setRange, filterValues, setFilterValue, visualFilters, addVisualFilter, removeVisualFilter, clearVisualFilters } =
    useDashboardFilters();

  const hourlyCost = data?.settings.hourlyCost || 0;
  const clientMargin = (c: ClientRecord) => c.clientRevenue - (c.actualHours * hourlyCost + c.billableExpenses);

  const records = useMemo(() => {
    let recs: ClientRecord[] = [...(data?.clients || [])];
    if (filterValues.tier) recs = recs.filter((r) => r.tier === filterValues.tier);
    if (filterValues.serviceLine) recs = recs.filter((r) => r.serviceLine === filterValues.serviceLine);
    if (visualFilters.client) recs = recs.filter((r) => r.name === visualFilters.client);
    return recs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterValues, visualFilters]);

  useSyncExportRows(records);

  const totalMargin = sum(records, clientMargin);
  const creepPct = (sum(records, "scopeCreepHours") / Math.max(sum(records, "contractHours"), 1)) * 100;
  const overService = (sum(records, "actualHours") / Math.max(sum(records, "contractHours"), 1)) * 100;

  const timeEntries = data?.time_entries || [];
  const billableHours = sum(timeEntries.filter((t) => t.billable), "hours");
  const nonBillableHours = sum(timeEntries.filter((t) => !t.billable), "hours");

  const scopeTrend = useMemo(() => Array.from({ length: 6 }, () => rand(10, 80)), [data]);

  if (!data) return null;

  return (
    <>
      <FilterBar
        range={range}
        onRangeChange={setRange}
        filters={[
          { key: "tier", label: "Client Tier", options: TIERS },
          { key: "serviceLine", label: "Service Line", options: SERVICES },
        ]}
        values={filterValues}
        onFilterChange={setFilterValue}
        visualFilters={visualFilters}
        onRemoveVisualFilter={removeVisualFilter}
        onClearVisualFilters={clearVisualFilters}
      />
      <KpiGrid
        items={[
          { label: "Gross Margin", value: money(totalMargin) },
          { label: "Scope Creep", value: pct(creepPct) },
          { label: "Profitability Score", value: totalMargin > 0 ? "A/B" : "C/D" },
          { label: "Over-service Ratio", value: pct(overService) },
        ]}
      />
      <div className="chart-grid">
        <ChartCard
          id="clientMargin"
          title="Gross Margin by Client"
          dashboard="clients"
          span={7}
          data={[{ x: records.map((c) => c.name), y: records.map(clientMargin), type: "bar" }]}
          onPointClick={(p) => p.x && addVisualFilter("client", String(p.x))}
        />
        <ChartCard
          id="billableDonut"
          title="Billable vs Non-Billable Hours"
          dashboard="clients"
          span={5}
          data={[{ labels: ["Billable", "Non-billable"], values: [billableHours, nonBillableHours], type: "pie", hole: 0.62 }]}
        />
        <ChartCard
          id="scopeScatter"
          title="Scope Creep % vs Margin %"
          dashboard="clients"
          span={6}
          data={[
            {
              x: records.map((c) => (c.scopeCreepHours / Math.max(c.contractHours, 1)) * 100),
              y: records.map((c) => (clientMargin(c) / Math.max(c.clientRevenue, 1)) * 100),
              text: records.map((c) => c.name),
              mode: "markers",
              type: "scatter",
              marker: { size: records.map((c) => Math.max(10, c.monthlyRetainer / 500)) },
            },
          ]}
        />
        <ChartCard
          id="scopeTrend"
          title="Scope Creep Trend"
          dashboard="clients"
          span={6}
          data={[{ x: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], y: scopeTrend, type: "scatter", mode: "lines+markers" }]}
        />
        <div className="table-card span-12">
          <h3>Clients Over Contracted Hours</h3>
          {canEdit ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn primary" onClick={() => openModal("addTimeEntry")}>
                Add time entry
              </button>
              <button className="btn" onClick={() => openModal("addClient")}>
                Add client
              </button>
            </div>
          ) : (
            <span className="badge">View only</span>
          )}
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Contract</th>
                <th>Actual</th>
                <th>Overage Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records
                .filter((c) => c.actualHours > c.contractHours)
                .map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.contractHours}</td>
                    <td>{c.actualHours}</td>
                    <td>{money((c.actualHours - c.contractHours) * hourlyCost)}</td>
                    <td>
                      <span className="badge bad">Scope Creep</span>
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
