import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Factory, Menu } from "lucide-react";
import { useListNavSettings } from "@workspace/api-client-react";
import { NAV_ITEMS, isNavItemHidden } from "@/lib/navItems";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import networkLogo from "../assets/network-logo.png";

function SidebarContent({
  location,
  navItems,
  onNavigate,
}: {
  location: string;
  navItems: typeof NAV_ITEMS;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link href="/" onClick={onNavigate}>
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
            <Link key={item.href} href={item.href} onClick={onNavigate}>
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
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: navSettings } = useListNavSettings();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMobileOpen(false), [location]);

  const overrides: Record<string, boolean> = {};
  for (const s of navSettings ?? []) overrides[s.key] = s.hidden;

  const navItems = NAV_ITEMS.filter(
    (item) => !isNavItemHidden(item, overrides),
  );

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between h-14 px-3 border-b border-sidebar-border bg-background shrink-0">
        <Link href="/">
          <span className="flex items-center gap-2 font-bold text-sidebar-foreground cursor-pointer">
            <Factory className="h-5 w-5 text-primary" />
            <span className="tracking-tight text-base">Manufacturing Synergy Hub</span>
          </span>
        </Link>
        <Button variant="ghost" size="icon" aria-label="메뉴 열기" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-background flex flex-col">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <SidebarContent location={location} navItems={navItems} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col shrink-0">
        <SidebarContent location={location} navItems={navItems} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
