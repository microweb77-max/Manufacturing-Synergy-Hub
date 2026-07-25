import { Link, useLocation } from "wouter";
import { Factory, ShieldCheck } from "lucide-react";
import { useListNavSettings } from "@workspace/api-client-react";
import { NAV_ITEMS, isNavItemHidden } from "@/lib/navItems";
import networkLogo from "../assets/network-logo.png";
import { useState } from "react";
import { useAdminAuth } from "@/lib/adminAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: navSettings } = useListNavSettings();
  const { checkPassword } = useAdminAuth();
  const [, navigate] = useLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const overrides: Record<string, boolean> = {};
  for (const s of navSettings ?? []) overrides[s.key] = s.hidden;

  const navItems = NAV_ITEMS.filter(
    (item) => !isNavItemHidden(item, overrides),
  );

  const openDialog = () => {
    setPassword("");
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = checkPassword(password);
    setSubmitting(false);
    if (ok) {
      setDialogOpen(false);
      navigate("/admin");
    } else {
      setError("비밀번호가 올바르지 않습니다.");
      setPassword("");
    }
  };

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
            className="w-[70%] mx-auto rounded-lg cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
            onClick={openDialog}
            title="관리자 로그인"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Admin Password Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              관리자 인증
            </DialogTitle>
            <DialogDescription>
              관리자 페이지에 접근하려면 비밀번호를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="admin-pw">비밀번호</Label>
              <Input
                id="admin-pw"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="비밀번호 입력"
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={submitting || !password}>
                확인
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
