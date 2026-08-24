"use client";

import { useMemo } from "react";
import FilterBar from "@/components/ui/FilterBar";
import KpiGrid from "@/components/ui/KpiGrid";
import ChartCard from "@/components/ui/ChartCard";
import { useAppStore } from "@/store/useAppStore";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { useSyncExportRows } from "@/hooks/useSyncExportRows";
import { useMoney } from "@/hooks/useMoney";
import { getDateFiltered, groupBy, monthKey, pct, sum } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export default function IncomeView() {
  const data = useAppStore((s) => s.data);
  const canEdit = useAppStore((s) => s.canEdit("income"));
  const deleteRecord = useAppStore((s) => s.deleteRecord);
  const money = useMoney();

  const { range, setRange, filterValues, setFilterValue, visualFilters, addVisualFilter, removeVisualFilter, clearVisualFilters } =
    useDashboardFilters();

  const transactions = data?.transactions || [];
  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))], [transactions]);

  const records = useMemo(() => {
    let recs: Transaction[] = getDateFiltered(transactions, range);
    if (filterValues.type) recs = recs.filter((r) => r.type === filterValues.type);
    if (filterValues.category) recs = recs.filter((r) => r.category === filterValues.category);
    if (visualFilters.category) recs = recs.filter((r) => r.category === visualFilters.category);
    if (visualFilters.date) recs = recs.filter((r) => r.date === visualFilters.date);
    return recs;
  }, [transactions, range, filterValues, visualFilters]);

  useSyncExportRows(records);

  const income = sum(records.filter((r) => r.type === "income"), "amount");
  const expense = sum(records.filter((r) => r.type === "expense"), "amount");
  const net = income - expense;
  const budgetPct = data ? (expense / data.settings.monthlyBudget) * 100 : 0;

  // --- chart data ---
  const byDate = useMemo(() => groupBy(records, (r) => r.date), [records]);
  const dates = useMemo(() => Object.keys(byDate).sort(), [byDate]);

  const expenses = useMemo(() => records.filter((r) => r.type === "expense"), [records]);
  const byCat = useMemo(() => groupBy(expenses, (r) => r.category), [expenses]);
  const cats = Object.keys(byCat);

  const byMonth = useMemo(() => groupBy(records, (r) => monthKey(r.date)), [records]);
  const months = Object.keys(byMonth).sort();

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const spendByDay = weekdays.map((_, i) => {
    const dayRecords = expenses.filter((r) => new Date(r.date).getDay() === i);
    return dayRecords.length ? sum(dayRecords, "amount") / dayRecords.length : 0;
  });

  if (!data) return null;

  return (
    <>
      <FilterBar
        range={range}
        onRangeChange={setRange}
        filters={[
          { key: "type", label: "Type", options: ["income", "expense"] },
          { key: "category", label: "Category", options: categories },
        ]}
        values={filterValues}
        onFilterChange={setFilterValue}
        visualFilters={visualFilters}
        onRemoveVisualFilter={removeVisualFilter}
        onClearVisualFilters={clearVisualFilters}
      />
      <KpiGrid
        items={[
          { label: "Total Income", value: money(income), note: "Filtered period" },
          { label: "Total Expense", value: money(expense), note: "Filtered period" },
          { label: "Net Cash Flow", value: money(net), note: net >= 0 ? "Profit position" : "Loss position" },
          { label: "Expense vs Budget", value: pct(budgetPct), note: "Monthly budget usage" },
        ]}
      />
      <div className="chart-grid">
        <ChartCard
          id="incomeTrend"
          title="Daily Income vs Expense"
          dashboard="income"
          span={8}
          data={[
            { x: dates, y: dates.map((d) => sum(byDate[d].filter((r) => r.type === "income"), "amount")), name: "Income", type: "scatter", mode: "lines+markers" },
            { x: dates, y: dates.map((d) => sum(byDate[d].filter((r) => r.type === "expense"), "amount")), name: "Expense", type: "scatter", mode: "lines+markers" },
          ]}
          onPointClick={(p) => p.x && addVisualFilter("date", String(p.x))}
        />
        <ChartCard
          id="expenseDonut"
          title="Expense by Category"
          dashboard="income"
          span={4}
          data={[{ labels: cats, values: cats.map((c) => sum(byCat[c], "amount")), type: "pie", hole: 0.62 }]}
          onPointClick={(p) => p.label && addVisualFilter("category", String(p.label))}
        />
        <ChartCard
          id="monthlyBar"
          title="Monthly Income / Expense"
          dashboard="income"
          span={6}
          data={[
            { x: months, y: months.map((m) => sum(byMonth[m].filter((r) => r.type === "income"), "amount")), name: "Income", type: "bar" },
            { x: months, y: months.map((m) => sum(byMonth[m].filter((r) => r.type === "expense"), "amount")), name: "Expense", type: "bar" },
          ]}
          layout={{ barmode: "stack" }}
        />
        <ChartCard
          id="waterfall"
          title="Net Cash Flow Waterfall"
          dashboard="income"
          span={6}
          data={[
            {
              x: months,
              y: months.map((m) => sum(byMonth[m].filter((r) => r.type === "income"), "amount") - sum(byMonth[m].filter((r) => r.type === "expense"), "amount")),
              type: "waterfall",
            },
          ]}
        />
        <ChartCard
          id="spendHeat"
          title="Weekday Spend Heatmap"
          dashboard="income"
          span={5}
          data={[{ z: [spendByDay], x: weekdays, y: ["Avg Spend"], type: "heatmap" }]}
        />
        <div className="table-card span-7">
          <h3>Last 20 Transactions</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {transactions
                .slice(-20)
                .reverse()
                .map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.type}</td>
                    <td>{t.category}</td>
                    <td>{money(t.amount)}</td>
                    <td>
                      {canEdit ? (
                        <button className="btn danger" onClick={() => deleteRecord("transactions", t.id)}>
                          Delete
                        </button>
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
