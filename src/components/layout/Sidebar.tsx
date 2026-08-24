"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getActiveNavHref } from "@/lib/constants";
import { useAppStore } from "@/store/useAppStore";

export default function Sidebar() {
  const pathname = usePathname();
  const canView = useAppStore((s) => s.canView);
  const currentUser = useAppStore((s) => s.currentUser());
  const logout = useAppStore((s) => s.logout);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  const visibleItems = NAV_ITEMS.filter((item) => canView(item.id));
  const activeHref = getActiveNavHref(pathname, visibleItems);

  return (
    <aside className="sidebar">
      <div className="brand">
        <Image src="/logo.png" alt="Imerge Digital" width={118} height={48} priority />
      </div>

      <nav className="nav">
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href} className={item.href === activeHref ? "active" : ""}>
            <i className={`fa-solid ${item.icon}`} />
            <span>{item.title}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="field">
          <label>Logged In As</label>
          <div className="user-switcher">
            <strong>{currentUser?.name}</strong>
            <br />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              {currentUser?.email}
              <br />
              {currentUser?.role}
            </span>
          </div>
        </div>
        <button className="theme-toggle" onClick={() => logout()}>
          <i className="fa-solid fa-right-from-bracket" /> Logout
        </button>
        <button className="theme-toggle" onClick={() => toggleTheme()}>
          <i className="fa-solid fa-moon" /> Toggle Theme
        </button>
      </div>
    </aside>
  );
}
