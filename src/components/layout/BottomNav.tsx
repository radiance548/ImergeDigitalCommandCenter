"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

export default function BottomNav() {
  const pathname = usePathname();
  const canView = useAppStore((s) => s.canView);
  const visibleItems = NAV_ITEMS.filter((item) => canView(item.id));

  return (
    <nav className="bottom-nav">
      {visibleItems.map((item) => (
        <Link key={item.id} href={`/${item.id}`} className={pathname === `/${item.id}` ? "active" : ""}>
          <i className={`fa-solid ${item.icon}`} />
          <span>{item.title.split(" ")[0]}</span>
        </Link>
      ))}
    </nav>
  );
}
