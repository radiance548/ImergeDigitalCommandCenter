"use client";

import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import { useUIStore, type ModalKey } from "@/store/useUIStore";
import type { DashboardId } from "@/lib/types";

const ROUTE_MODAL: Partial<Record<DashboardId, Exclude<ModalKey, null>>> = {
  income: "addTransaction",
  clients: "addTimeEntry",
  pipeline: "addDeal",
  marketing: "addCampaign",
  health: "addHealthRecord",
  ltv: "addCustomer",
};

export default function FloatingAdd() {
  const pathname = usePathname();
  const route = (pathname?.split("/")[1] || "income") as DashboardId;
  const canEdit = useAppStore((s) => s.canEdit(route));
  const openModal = useUIStore((s) => s.openModal);

  if (route === "settings" || !canEdit) return null;

  const modalKey = ROUTE_MODAL[route];

  return (
    <button
      className="float-add"
      onClick={() => (modalKey ? openModal(modalKey) : alert("Use the table buttons on this dashboard."))}
      aria-label="Quick add"
    >
      <i className="fa-solid fa-plus" />
    </button>
  );
}
