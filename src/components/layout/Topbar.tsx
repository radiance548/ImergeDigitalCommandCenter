"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore } from "@/store/useUIStore";
import { downloadRowsAsCSV, exportDashboardPDF } from "@/lib/exportUtils";
import type { DashboardId, Permission } from "@/lib/types";

function permissionLabel(value: Permission): string {
  return value === "full" ? "Full access" : value === "edit" ? "Can edit" : value === "view" ? "View only" : "No access";
}

export default function Topbar() {
  const pathname = usePathname();
  const route = (pathname?.split("/")[1] || "income") as DashboardId;
  const item = NAV_ITEMS.find((n) => n.id === route) || NAV_ITEMS[0];

  const currentUser = useAppStore((s) => s.currentUser());
  const permission = useAppStore((s) => s.permission(route));
  const canExport = useAppStore((s) => s.canExport(route));
  const isAdmin = useAppStore((s) => s.isAdmin());
  const resetDemoData = useAppStore((s) => s.resetDemoData);
  const exportRows = useUIStore((s) => s.exportRows);

  const handleReset = async () => {
    if (!confirm("Reset all records to fresh demo data?")) return;
    await resetDemoData();
  };

  const handlePDF = async () => {
    const target = document.getElementById("dashboard-main");
    if (target) await exportDashboardPDF(target, route);
  };

  return (
    <section className="topbar">
      <div className="page-title">
        <h1>{item.title}</h1>
        <p>{item.question}</p>
      </div>
      <div className="actions">
        <span className="role-pill">
          <i className="fa-solid fa-user-shield" /> {currentUser?.role} • {permissionLabel(permission)}
        </span>
        {canExport && (
          <>
            <button className="btn" onClick={() => downloadRowsAsCSV(exportRows, `${route}-export.csv`)}>
              <i className="fa-solid fa-file-csv" /> CSV
            </button>
            <button className="btn" onClick={handlePDF}>
              <i className="fa-solid fa-file-pdf" /> PDF
            </button>
          </>
        )}
        {isAdmin && (
          <button className="btn primary" onClick={handleReset}>
            <i className="fa-solid fa-rotate" /> Reset Demo
          </button>
        )}
      </div>
    </section>
  );
}
