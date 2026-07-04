import { Link, useLocation } from "wouter";
import { Factory } from "lucide-react";
import { useListNavSettings } from "@workspace/api-client-react";
import { NAV_ITEMS, isNavItemHidden } from "@/lib/navItems";
import networkLogo from "../assets/network-logo.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: navSettings } = useListNavSettings();

  const overrides: Record<string, boolean> = {};
  for (const s of navSettings ?? []) overrides[s.key] = s.hidden;

  const navItems = NAV_ITEMS.filter(
    (item) => !isNavItemHidden(item, overrides),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <Link href="/">
          <div className="p-6 cursor-pointer">
            <h1 className="text-xl font-bold text-sidebar-foreground flex items-center gap-2">
              <Factory className="h-6 w-6 text-primary" />
              <span className="tracking-tight">Manufacturing Synergy Hub</span>
            </h1>
            <p className="mt-1.5 text-xs text-sidebar-foreground/60 text-center">베트남 제조산업 협력 네트워크</p>
          </div>
        </Link>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <span className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 mt-auto">
          <img
            src={networkLogo}
            alt="Vietnam Manufacturing Network"
            className="w-[70%] mx-auto rounded-lg"
          />
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
