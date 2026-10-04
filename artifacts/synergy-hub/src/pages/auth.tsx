import { SignIn, SignUp, useAuth } from "@clerk/react";
import { Link } from "wouter";
import { basePath } from "@/lib/clerk";
import { useAdminAuth } from "@/lib/adminAuth";
import { Button } from "@/components/ui/button";

export function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
export function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}
function AuthFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 gap-6">
    <Link href="/" className="text-primary font-semibold">Co-selling Hub · 공개 페이지로 돌아가기</Link>
    {children}
    <p className="text-sm text-muted-foreground">둘러보기는 공개 · 회사 인증 및 회원 활동 기능은 준비 중입니다.</p>
  </div>;
}
export function WriteGuard({ children }: { children: React.ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { isLoaded, isAdmin, error } = useAdminAuth();
  if (!isLoaded) return <p className="p-8">계정 권한을 확인하는 중입니다…</p>;
  if (isAdmin) return <>{children}</>;
  return <section className="p-8 space-y-4">
    <h1 className="text-xl font-bold">{error ? "권한 확인 실패" : isSignedIn ? "플랫폼 관리자 권한이 필요합니다" : "로그인이 필요합니다"}</h1>
    <p className="text-muted-foreground">{error ? "잠시 후 새로고침하여 다시 시도하세요." : "회사 인증 기능 도입 전까지 등록·수정·삭제는 플랫폼 관리자만 가능합니다. 공개 열람은 계속 이용할 수 있습니다."}</p>
    {!isSignedIn && <Link href="/sign-in"><Button>로그인 / 회원가입</Button></Link>}
    {isSignedIn && <p className="text-sm break-all">관리자 권한 신청 시 전달할 계정 ID: {userId}</p>}
    <Link href="/" className="block text-primary">공개 페이지로 돌아가기</Link>
  </section>;
}