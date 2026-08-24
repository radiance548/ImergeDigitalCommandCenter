"use client";

import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

export default function AccessDenied() {
  const router = useRouter();
  const canView = useAppStore((s) => s.canView);
  const currentUser = useAppStore((s) => s.currentUser());

  const goToAllowed = () => {
    const first = NAV_ITEMS.find((n) => canView(n.id));
    if (first) router.push(first.href);
  };

  return (
    <div className="access-denied">
      <i className="fa-solid fa-lock" />
      <h2>Access denied</h2>
      <p style={{ color: "var(--muted)", fontWeight: 700 }}>
        {currentUser?.name || "This user"} does not have permission to view this dashboard.
      </p>
      <button className="btn primary" onClick={goToAllowed}>
        Go to allowed dashboard
      </button>
    </div>
  );
}
