import { SignIn, SignUp, useAuth } from "@clerk/react";
import { Link } from "wouter";
import { basePath } from "@/lib/clerk";
import { useAdminAuth } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";

function returnPath() {
  const candidate = new URLSearchParams(window.location.search).get("forceRedirectUrl");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return undefined;
  const url = new URL(candidate, window.location.origin);
  return url.origin === window.location.origin && url.pathname.startsWith(`${basePath}/`) ? url.pathname : undefined;
}
export function SignInPage() {
  const redirect = returnPath();
  const query = redirect ? `?forceRedirectUrl=${encodeURIComponent(redirect)}` : "";
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} forceRedirectUrl={redirect} signUpUrl={`${basePath}/sign-up${query}`} /></AuthFrame>;
}
export function SignUpPage() {
  const redirect = returnPath();
  const query = redirect ? `?forceRedirectUrl=${encodeURIComponent(redirect)}` : "";
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} forceRedirectUrl={redirect} signInUrl={`${basePath}/sign-in${query}`} /></AuthFrame>;
}
function AuthFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 gap-6">
    <Link href="/" className="text-primary font-semibold">Co-selling Hub · 공개 페이지로 돌아가기</Link>
    {children}
    <p className="text-sm text-muted-foreground">둘러보기는 공개 · 로그인 후 기존 회사 프로필을 인증하고 회사 활동을 관리할 수 있습니다.</p>
  </div>;
}
export function WriteGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { isLoaded, isAdmin, error } = useAdminAuth();
  if (!isLoaded) return <p className="p-8">계정 권한을 확인하는 중입니다…</p>;
  if (isAdmin) return <>{children}</>;
  return <section className="p-8 space-y-4">
    <h1 className="text-xl font-bold">{error ? "권한 확인 실패" : isSignedIn ? "플랫폼 관리자 권한이 필요합니다" : "로그인이 필요합니다"}</h1>
    <p className="text-muted-foreground">{error ? "잠시 후 새로고침하여 다시 시도하세요." : "이 화면은 플랫폼 관리자 전용입니다. 회사 정보는 회사 상세 화면에서 인증 후 관리하세요. 공개 열람은 계속 이용할 수 있습니다."}</p>
    {!isSignedIn && <Link href="/sign-in"><Button>로그인 / 회원가입</Button></Link>}
    {isSignedIn && <p className="text-sm break-all">관리자 권한 신청 시 전달할 계정 ID: {userId}</p>}
    <Link href="/" className="block text-primary">공개 페이지로 돌아가기</Link>
  </section>;
}