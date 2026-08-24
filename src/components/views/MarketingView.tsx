"use client";

import Link from "next/link";
import { useMemo } from "react";
import FilterBar from "@/components/ui/FilterBar";
import KpiGrid from "@/components/ui/KpiGrid";
import ChartCard from "@/components/ui/ChartCard";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useSyncExportRows } from "@/hooks/useSyncExportRows";
import { useMoney } from "@/hooks/useMoney";
import { getDateFiltered, groupBy, rand, sum } from "@/lib/utils";
import type { DailyMetric } from "@/lib/types";

const CHANNELS = ["SEO", "PPC", "Social", "Email"];

export default function MarketingView() {
  const data = useAppStore((s) => s.data);
  const canEdit = useAppStore((s) => s.canEdit("marketing"));
  const addDemoCampaign = useAppStore((s) => s.addDemoCampaign);
  const openModal = useUIStore((s) => s.openModal);
  const money = useMoney();

  const { range, setRange, filterValues, setFilterValue, visualFilters, addVisualFilter, removeVisualFilter, clearVisualFilters } =
    useDashboardFilters();

  const dailyMetrics = data?.daily_metrics || [];
  const campaigns = data?.campaigns || [];

  const records = useMemo(() => {
    let recs: DailyMetric[] = getDateFiltered(dailyMetrics, range);
    if (filterValues.channel) recs = recs.filter((r) => r.channel === filterValues.channel);
    if (visualFilters.channel) recs = recs.filter((r) => r.channel === visualFilters.channel);
    return recs;
  }, [dailyMetrics, range, filterValues, visualFilters]);

  useSyncExportRows(records);

  const spend = sum(records, "spend");
  const leads = sum(records, "leads");
  const clicks = sum(records, "clicks");
  const customerCount = data?.customers.length || 0;
  const revenue = sum(campaigns, "revenue");

  const byDate = useMemo(() => groupBy(records, (r) => r.date), [records]);
  const dates = Object.keys(byDate).sort();

  const byChannel = useMemo(() => groupBy(records, (r) => r.channel), [records]);
  const channels = Object.keys(byChannel);

  const heatZ = useMemo(() => Array.from({ length: 5 }, () => Array.from({ length: 7 }, () => rand(1, 40))), [records]);

  if (!data) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link href="/marketing/campaigns" className="btn primary">
          <i className="fa-solid fa-paper-plane" /> Campaign Builder
        </Link>
      </div>
      <FilterBar
        range={range}
        onRangeChange={setRange}
        filters={[{ key: "channel", label: "Channel", options: CHANNELS }]}
        values={filterValues}
        onFilterChange={setFilterValue}
        visualFilters={visualFilters}
        onRemoveVisualFilter={removeVisualFilter}
        onClearVisualFilters={clearVisualFilters}
      />
      <KpiGrid
        items={[
          { label: "Total Spend", value: money(spend) },
          { label: "Total Leads", value: leads.toLocaleString() },
          { label: "CPL", value: money(leads ? spend / leads : 0) },
          { label: "ROAS", value: `${(revenue / Math.max(spend, 1)).toFixed(2)}x` },
        ]}
      />
      <div className="chart-grid">
        <ChartCard
          id="mkTrend"
          title="Spend vs Leads Over Time"
          dashboard="marketing"
          span={8}
          layout={{ yaxis2: { overlaying: "y", side: "right" } }}
          data={[
            { x: dates, y: dates.map((d) => sum(byDate[d], "spend")), name: "Spend", type: "scatter", mode: "lines" },
            { x: dates, y: dates.map((d) => sum(byDate[d], "leads")), name: "Leads", type: "scatter", mode: "lines", yaxis: "y2" },
          ]}
        />
        <ChartCard
          id="mkDonut"
          title="Spend Distribution"
          dashboard="marketing"
          span={4}
          data={[{ labels: channels, values: channels.map((c) => sum(byChannel[c], "spend")), type: "pie", hole: 0.62 }]}
          onPointClick={(p) => p.label && addVisualFilter("channel", String(p.label))}
        />
        <ChartCard
          id="mkCpl"
          title="CPL by Channel"
          dashboard="marketing"
          span={6}
          data={[{ x: channels, y: channels.map((c) => sum(byChannel[c], "spend") / Math.max(sum(byChannel[c], "leads"), 1)), type: "bar" }]}
          onPointClick={(p) => p.x && addVisualFilter("channel", String(p.x))}
        />
        <ChartCard
          id="mkFunnel"
          title="Marketing Funnel"
          dashboard="marketing"
          span={6}
          data={[{ type: "funnel", y: ["Impressions", "Clicks", "Leads", "Customers"], x: [clicks * 12, clicks, leads, customerCount] }]}
        />
        <ChartCard
          id="mkHeat"
          title="Best Days / Hours for Conversions"
          dashboard="marketing"
          span={5}
          data={[{ x: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], y: ["8am", "11am", "2pm", "5pm", "8pm"], z: heatZ, type: "heatmap" }]}
        />
        <div className="table-card span-7">
          <h3>Recent Campaign Activities</h3>
          {canEdit ? (
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button className="btn primary" onClick={() => openModal("addCampaign")}>
                Add campaign
              </button>
              <button className="btn" onClick={() => addDemoCampaign()}>
                Add demo campaign
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
                <th>Spend</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(-10).map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.channel}</td>
                  <td>{money(c.spend)}</td>
                  <td>{money(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
