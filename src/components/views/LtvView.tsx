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
import { groupBy, pct, rand, sum } from "@/lib/utils";
import type { Customer } from "@/lib/types";

const CHANNELS = ["SEO", "PPC", "Social", "Email"];

export default function LtvView() {
  const data = useAppStore((s) => s.data);
  const canEdit = useAppStore((s) => s.canEdit("ltv"));
  const addDemoCustomer = useAppStore((s) => s.addDemoCustomer);
  const churnSimulation = useAppStore((s) => s.churnSimulation);
  const openModal = useUIStore((s) => s.openModal);
  const money = useMoney();

  const { range, setRange, filterValues, setFilterValue, visualFilters, addVisualFilter, removeVisualFilter, clearVisualFilters } =
    useDashboardFilters();

  const records = useMemo(() => {
    let recs: Customer[] = [...(data?.customers || [])];
    if (filterValues.channel) recs = recs.filter((r) => r.acquisitionChannel === filterValues.channel);
    if (visualFilters.channel) recs = recs.filter((r) => r.acquisitionChannel === visualFilters.channel);
    return recs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterValues, visualFilters]);

  useSyncExportRows(records);

  const avgCAC = sum(records, "cac") / Math.max(records.length, 1);
  const avgLTV = sum(records, "lifetimeRevenue") / Math.max(records.length, 1);
  const ratio = avgLTV / Math.max(avgCAC, 1);
  const active = records.filter((c) => !c.churnDate).length;
  const retention = (active / Math.max(records.length, 1)) * 100;

  const byChannel = useMemo(() => groupBy(records, (r) => r.acquisitionChannel), [records]);
  const channels = Object.keys(byChannel);

  const mrr = useMemo(() => Array.from({ length: 6 }, () => rand(9000, 44000)), [data]);

  if (!data) return null;

  return (
    <>
      <FilterBar
        range={range}
        onRangeChange={setRange}
        filters={[{ key: "channel", label: "Acquisition Channel", options: CHANNELS }]}
        values={filterValues}
        onFilterChange={setFilterValue}
        visualFilters={visualFilters}
        onRemoveVisualFilter={removeVisualFilter}
        onClearVisualFilters={clearVisualFilters}
      />
      <KpiGrid
        items={[
          { label: "Average CAC", value: money(avgCAC) },
          { label: "Average LTV", value: money(avgLTV) },
          { label: "LTV:CAC Ratio", value: `${ratio.toFixed(2)}x`, note: `Target ${data.settings.targetLtvCac}x` },
          { label: "Retention Rate", value: pct(retention) },
        ]}
      />
      <div className="chart-grid">
        <ChartCard
          id="cacChannel"
          title="CAC by Channel"
          dashboard="ltv"
          span={6}
          data={[{ x: channels, y: channels.map((c) => sum(byChannel[c], "cac") / byChannel[c].length), type: "bar" }]}
          onPointClick={(p) => p.x && addVisualFilter("channel", String(p.x))}
        />
        <ChartCard
          id="ltvChannel"
          title="LTV by Channel"
          dashboard="ltv"
          span={6}
          data={[{ x: channels, y: channels.map((c) => sum(byChannel[c], "lifetimeRevenue") / byChannel[c].length), type: "bar" }]}
        />
        <ChartCard
          id="ltvScatter"
          title="LTV vs CAC by Customer"
          dashboard="ltv"
          span={7}
          data={[{ x: records.map((c) => c.cac), y: records.map((c) => c.lifetimeRevenue), text: records.map((c) => c.name), mode: "markers", type: "scatter" }]}
        />
        <ChartCard
          id="mrr"
          title="MRR from Retained Customers"
          dashboard="ltv"
          span={5}
          data={[{ x: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], y: mrr, type: "scatter", mode: "lines+markers" }]}
        />
        <ChartCard
          id="ltvWater"
          title="CAC to LTV Waterfall"
          dashboard="ltv"
          span={5}
          data={[
            {
              x: ["CAC", "First Year", "Upsells", "Churn Impact", "Lifetime Value"],
              y: [-avgCAC, 6000, 9000, -2500, avgLTV],
              type: "waterfall",
            },
          ]}
        />
        <div className="table-card span-7">
          <h3>Customer Table</h3>
          {canEdit ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <button className="btn primary" onClick={() => openModal("addCustomer")}>
                Add customer
              </button>
              <button className="btn" onClick={() => addDemoCustomer()}>
                Add demo customer
              </button>
              <button className="btn danger" onClick={() => churnSimulation()}>
                Churn simulation
              </button>
            </div>
          ) : (
            <span className="badge">View only</span>
          )}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>CAC</th>
                <th>LTV</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 20).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.acquisitionChannel}</td>
                  <td>{money(c.cac)}</td>
                  <td>{money(c.lifetimeRevenue)}</td>
                  <td>
                    <span className={`badge ${c.churnDate ? "bad" : "good"}`}>{c.churnDate ? "Churned" : "Active"}</span>
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
