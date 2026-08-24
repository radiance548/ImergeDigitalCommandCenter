"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getActiveNavHref } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

export default function BottomNav() {
  const pathname = usePathname();
  const canView = useAppStore((s) => s.canView);
  const visibleItems = NAV_ITEMS.filter((item) => canView(item.id));
  const activeHref = getActiveNavHref(pathname, visibleItems);

  return (
    <nav className="bottom-nav">
      {visibleItems.map((item) => (
        <Link key={item.href} href={item.href} className={item.href === activeHref ? "active" : ""}>
          <i className={`fa-solid ${item.icon}`} />
          <span>{item.title.split(" ")[0]}</span>
        </Link>
      ))}
    </nav>
  );
}
