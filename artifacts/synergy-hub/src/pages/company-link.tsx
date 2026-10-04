import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useConsumeCompanyLink } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { basePath } from "@/lib/clerk";
import { errMsg } from "@/components/membership-common";

export default function CompanyLinkPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const consume = useConsumeCompanyLink();
  const [error, setError] = useState<string | null>(null);
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const hashToken = new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? hash.replace(/^#/, "");
  const [token] = useState(() => {
    if (hashToken) return hashToken;
    try {
      const saved = JSON.parse(sessionStorage.getItem("company-link-return") ?? "null");
      return saved && saved.expiresAt > Date.now() ? String(saved.token) : "";
    } catch { return ""; }
  });

  const confirm = () => {
    setError(null);
    consume.mutate({ data: { token } }, {
      onSuccess: (r) => {
        try { sessionStorage.removeItem("company-link-return"); } catch { /* No saved token when tab storage is unavailable. */ }
        history.replaceState(null, "", window.location.pathname + window.location.search);
        qc.invalidateQueries();
        navigate(`/companies/${r.companyId}`);
      },
      onError: (e) => setError(errMsg(e, "링크가 만료되었거나 이미 사용되었거나 다른 계정으로 로그인되어 있습니다.")),
    });
  };

  // Never put a raw claim token in a sign-in query or an auth-provider redirect.
  // Preserve it in this tab only while login redirects back to the token-free page.
  const signInHref = `${basePath}/sign-in?forceRedirectUrl=${encodeURIComponent(`${basePath}/company-link`)}`;
  const preserveForLogin = () => {
    try { sessionStorage.setItem("company-link-return", JSON.stringify({ token, expiresAt: Date.now() + 30 * 60_000 })); }
    catch { setError("로그인 후 메일의 링크를 다시 열어주세요."); }
  };

  return (
    <div className="p-8 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">회사 연결 확인</h1>
      {!token ? (
        <p className="text-muted-foreground" data-testid="text-link-missing">유효한 링크가 아닙니다. 메일의 링크를 다시 열어주세요.</p>
      ) : !isLoaded ? (
        <p className="text-muted-foreground">계정 상태를 확인하는 중입니다…</p>
      ) : !isSignedIn ? (
        <>
          <p className="text-muted-foreground">링크를 사용하려면 초대받은 이메일 계정으로 로그인해야 합니다.</p>
          <a href={signInHref} onClick={preserveForLogin}><Button data-testid="button-link-login">로그인</Button></a>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">현재 로그인한 계정을 회사에 연결합니다. 본인 계정이 맞는지 확인한 뒤 진행하세요. 자동으로 처리되지 않습니다.</p>
          {error && <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3" role="alert" data-testid="text-link-error">{error}</p>}
          <Button onClick={confirm} disabled={consume.isPending} data-testid="button-link-confirm">{consume.isPending ? "처리 중..." : "이 계정으로 연결 확인"}</Button>
        </>
      )}
      <Link href="/" className="block text-sm text-primary">홈으로</Link>
    </div>
  );
}
