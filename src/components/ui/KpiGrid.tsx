export interface KpiItem {
  label: string;
  value: string;
  note?: string;
}

export default function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-grid">
      {items.map((i) => (
        <div className="kpi-card" key={i.label}>
          <small>{i.label}</small>
          <h2>{i.value}</h2>
          <span>{i.note || ""}</span>
        </div>
      ))}
    </div>
  );
}
