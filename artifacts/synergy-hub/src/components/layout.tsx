import { Link, useLocation } from "wouter";
import { 
  Factory, 
  Activity, 
  Network, 
  Server, 
  BarChart, 
  LayoutDashboard
} from "lucide-react";
import networkLogo from "@assets/image_1782638929542.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "대시보드", icon: LayoutDashboard },
    { href: "/companies", label: "기업 디렉토리", icon: Factory },
    { href: "/projects", label: "프로젝트", icon: Activity },
    { href: "/matches", label: "매칭 보드", icon: Network },
    { href: "/solutions", label: "솔루션 갤러리", icon: Server },
    { href: "/performance", label: "성과 보드", icon: BarChart },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-foreground flex items-center gap-2">
            <Factory className="h-6 w-6 text-primary" />
            <span className="tracking-tight">Manufacturing Synergy Hub</span>
          </h1>
          <p className="mt-1.5 text-xs text-sidebar-foreground/60 text-center">베트남 제조산업 협력 네트워크</p>
        </div>
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
            className="w-full rounded-lg"
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
