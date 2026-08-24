"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import Topbar from "./Topbar";
import FloatingAdd from "./FloatingAdd";
import ModalHost from "@/components/modals/ModalHost";
import LoginScreen from "@/components/auth/LoginScreen";
import AccessDenied from "@/components/auth/AccessDenied";
import { useAppStore } from "@/store/useAppStore";
import type { DashboardId } from "@/lib/types";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const isLoading = useAppStore((s) => s.isLoading);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const theme = useAppStore((s) => s.theme);
  const init = useAppStore((s) => s.init);
  const canView = useAppStore((s) => s.canView);
  const pathname = usePathname();
  const route = (pathname?.split("/")[1] || "income") as DashboardId;

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  if (isLoading) {
    return (
      <section className="login-screen">
        <p style={{ color: "var(--muted)", fontWeight: 700 }}>Loading Imerge Command Center…</p>
      </section>
    );
  }

  if (!currentUserId) {
    return <LoginScreen />;
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main" id="dashboard-main">
        <Topbar />
        {canView(route) ? children : <AccessDenied />}
      </main>
      <BottomNav />
      <FloatingAdd />
      <ModalHost />
    </div>
  );
}
