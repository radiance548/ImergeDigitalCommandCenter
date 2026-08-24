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
import { groupBy, monthKey, pct, rand, sum } from "@/lib/utils";

export default function HealthView() {
  const data = useAppStore((s) => s.data);
  const canEdit = useAppStore((s) => s.canEdit("health"));
  const openModal = useUIStore((s) => s.openModal);
  const money = useMoney();

  const { range, setRange, visualFilters, removeVisualFilter, clearVisualFilters } = useDashboardFilters();

  useSyncExportRows(data?.transactions || []);

  const metrics = useMemo(() => {
    if (!data) return null;
    const income = sum(data.transactions.filter((t) => t.type === "income"), "amount");
    const expense = sum(data.transactions.filter((t) => t.type === "expense"), "amount");
    const profit = income - expense;
    const monthlyBurn = expense / 3;
    const cash = Math.max(25000, profit + 95000);
    const runway = cash / Math.max(monthlyBurn, 1);
    const margin = (profit / Math.max(income, 1)) * 100;

    const byMonth = groupBy(data.transactions, (r) => monthKey(r.date));
    const months = Object.keys(byMonth).sort();
    const forecastMonths = ["Now", "+1", "+2", "+3", "+4", "+5", "+6"];
    const cashForecast = forecastMonths.map((_, i) => Math.max(0, cash - monthlyBurn * i + rand(-3000, 6000)));
    const fixed = months.map(() => rand(6000, 18000));
    const variable = months.map(() => rand(2500, 12000));

    return { income, expense, profit, monthlyBurn, cash, runway, margin, byMonth, months, forecastMonths, cashForecast, fixed, variable };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data || !metrics) return null;
  const { monthlyBurn, cash, runway, margin, byMonth, months, forecastMonths, cashForecast, fixed, variable } = metrics;

  return (
    <>
      <FilterBar
        range={range}
        onRangeChange={setRange}
        values={{}}
        onFilterChange={() => {}}
        visualFilters={visualFilters}
        onRemoveVisualFilter={removeVisualFilter}
        onClearVisualFilters={clearVisualFilters}
      />
      <KpiGrid
        items={[
          { label: "Current Cash Balance", value: money(cash) },
          { label: "Monthly Burn Rate", value: money(monthlyBurn) },
          { label: "Runway", value: `${runway.toFixed(1)} mo`, note: runway < 6 ? "Needs action" : "Healthy" },
          { label: "Net Profit Margin", value: pct(margin) },
        ]}
      />
      <div className="chart-grid">
        <ChartCard
          id="runwayGauge"
          title="Runway Gauge"
          dashboard="health"
          span={4}
          data={[
            {
              type: "indicator",
              mode: "gauge+number",
              value: runway,
              gauge: { axis: { range: [0, 24] }, steps: [{ range: [0, 6] }, { range: [6, 12] }, { range: [12, 24] }] },
            },
          ]}
        />
        <ChartCard
          id="cashForecast"
          title="Cash Balance Forecast"
          dashboard="health"
          span={8}
          data={[{ x: forecastMonths, y: cashForecast, type: "scatter", mode: "lines+markers" }]}
        />
        <ChartCard
          id="revExpense"
          title="Revenue vs Expense by Month"
          dashboard="health"
          span={6}
          layout={{ barmode: "group" }}
          data={[
            { x: months, y: months.map((m) => sum(byMonth[m].filter((r) => r.type === "income"), "amount")), name: "Revenue", type: "bar" },
            { x: months, y: months.map((m) => sum(byMonth[m].filter((r) => r.type === "expense"), "amount")), name: "Expense", type: "bar" },
          ]}
        />
        <ChartCard
          id="fixedVariable"
          title="Fixed vs Variable Expenses"
          dashboard="health"
          span={6}
          layout={{ barmode: "stack" }}
          data={[
            { x: months, y: fixed, name: "Fixed", type: "bar" },
            { x: months, y: variable, name: "Variable", type: "bar" },
          ]}
        />
        <div className="panel-card span-12">
          <h3>Business Health Data</h3>
          {canEdit ? (
            <button className="btn primary" onClick={() => openModal("addHealthRecord")}>
              Add income / expense record
            </button>
          ) : (
            <span className="badge">View only</span>
          )}
          <p style={{ color: "var(--muted)", fontWeight: 700 }}>
            Business Health is calculated from Income &amp; Expense, Client Profitability, and global settings. Add
            financial records here or from the Income dashboard.
          </p>
        </div>
        <div className="panel-card span-12">
          <h3>Alerts Panel</h3>
          <div className="alert-list">
            <div className="alert">
              {runway < 6 ? "Runway is below 6 months. Reduce burn or increase sales." : "Runway is above emergency level."}
            </div>
            <div className="alert">{margin < 10 ? "Profit margin is below 10%." : "Margin is currently above the 10% danger zone."}</div>
            <div className="alert">
              {cash < monthlyBurn * 3 ? "Cash is below 3x monthly burn." : "Cash reserve is above 3x monthly burn."}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
