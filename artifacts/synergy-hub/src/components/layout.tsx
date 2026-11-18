import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Factory, Menu } from "lucide-react";
import { useListNavSettings } from "@workspace/api-client-react";
import { NAV_ITEMS, isNavItemHidden } from "@/lib/navItems";
import networkLogo from "../assets/network-logo.png";
import { useAdminAuth } from "@/lib/adminAuth";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Shared by desktop and mobile: changing the layout must not drop member menus.
function SidebarContent({
  location, navItems, onNavigate, onAdminNavigate,
}: {
  location: string;
  navItems: typeof NAV_ITEMS;
  onNavigate: () => void;
  onAdminNavigate: () => void;
}) {
  return <>
    <Link href="/" onClick={onNavigate}>
      <div className="p-6 cursor-pointer">
        <h1 className="text-xl font-bold text-sidebar-foreground flex items-center gap-2">
          <Factory className="h-6 w-6 shrink-0 text-primary" />
          <span className="tracking-tight">Manufacturing Synergy Hub</span>
        </h1>
        <p className="mt-1.5 text-xs text-sidebar-foreground/60 text-center">베트남 제조산업 협력 네트워크</p>
      </div>
    </Link>
    <nav className="flex-1 px-4 space-y-1" aria-label="주 메뉴">
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return <Link key={item.href} href={item.href} onClick={onNavigate}>
          <span aria-current={isActive ? "page" : undefined} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            isActive ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          }`}>
            <item.icon className="h-4 w-4" />
            {item.label}
          </span>
        </Link>;
      })}
    </nav>
    <div className="p-4 mt-auto">
      <button type="button" className="block w-full opacity-90 hover:opacity-100 transition-opacity"
        onClick={onAdminNavigate} title="관리자 로그인" aria-label="관리자 로그인">
        <img src={networkLogo} alt="Vietnam Manufacturing Network" className="w-[70%] mx-auto rounded-lg" />
      </button>
    </div>
  </>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: navSettings } = useListNavSettings();
  const { isAdmin, logout } = useAdminAuth();
  const { isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [location]);

  const overrides: Record<string, boolean> = {};
  for (const s of navSettings ?? []) overrides[s.key] = s.hidden;

  const navItems = NAV_ITEMS.filter(
    (item) => !isNavItemHidden(item, overrides),
  );
  const closeMenu = () => setMobileOpen(false);
  const sidebar = <SidebarContent location={location} navItems={navItems}
    onNavigate={closeMenu} onAdminNavigate={() => {
      closeMenu();
      navigate(isSignedIn ? "/admin" : "/sign-in");
    }} />;

  return (
    <div className="flex flex-col md:flex-row h-dvh overflow-hidden bg-background">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <header className="md:hidden flex items-center justify-between gap-2 h-14 px-3 border-b bg-background shrink-0">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-bold text-sm">
            <Factory className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate">Manufacturing Synergy Hub</span>
          </Link>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label="메뉴 열기">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
        </header>
        <SheetContent side="left" className="w-72 max-w-[85vw] p-0 bg-background flex flex-col overflow-y-auto" aria-describedby={undefined}>
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <aside className="hidden md:flex w-64 bg-sidebar border-r border-sidebar-border flex-col shrink-0 overflow-y-auto">
        {sidebar}
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 border-b px-4 md:px-6 py-3">
          <span className="text-sm text-muted-foreground">{isSignedIn ? (isAdmin ? "플랫폼 관리자" : "회원") : "공개 열람"}</span>
          {isSignedIn ? <>
            <Link href="/my-companies"><Button variant="outline" size="sm" data-testid="link-my-companies">내 회사</Button></Link>
            <Link href="/admin"><Button variant="outline" size="sm">{isAdmin ? "관리자 화면" : "계정 권한"}</Button></Link>
            <Button variant="outline" size="sm" onClick={logout}>로그아웃</Button>
          </> : <>
            <Link href="/sign-in"><Button variant="outline" size="sm">로그인</Button></Link>
            <Link href="/sign-up"><Button size="sm">회원가입</Button></Link>
          </>}
        </div>
        {!isAdmin && <p className="bg-muted px-4 md:px-6 py-2 text-sm text-muted-foreground">공개 열람은 자유롭게 이용하세요. 회사 등록·수정·삭제는 인증된 회사 구성원 또는 플랫폼 관리자만 가능합니다.</p>}
        {children}
      </main>
    </div>
  );
}
