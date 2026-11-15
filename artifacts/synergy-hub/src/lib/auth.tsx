import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAuthMe,
  useAdminLogin,
  useAdminLogout,
  getGetAuthMeQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, LogOut, Loader2 } from "lucide-react";

/** Extracts the server's `{ error }` message from an ApiError, if any. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg) return msg;
  }
  return fallback;
}

/** Whether the current browser holds a valid admin session. */
export function useIsAdmin(): boolean {
  const { data } = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey(), staleTime: 60_000 } });
  return data?.isAdmin === true;
}

function LoginForm() {
  const queryClient = useQueryClient();
  const { data: me } = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey() } });
  const login = useAdminLogin();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate(
      { data: { password } },
      {
        onSuccess: (status) => {
          setPassword("");
          queryClient.setQueryData(getGetAuthMeQueryKey(), status);
          // Refetch everything so admin-only data loads with the new session.
          void queryClient.invalidateQueries();
        },
        onError: (err) => setError(apiErrorMessage(err, "로그인에 실패했습니다.")),
      },
    );
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>관리자 로그인</CardTitle>
          <CardDescription>관리자 콘솔은 로그인 후 이용할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {me && !me.configured ? (
            <p className="text-sm text-destructive text-center">
              서버에 관리자 비밀번호(ADMIN_PASSWORD)가 설정되지 않았습니다. Replit Secrets에서 설정 후 다시 배포해주세요.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                type="password"
                autoFocus
                autoComplete="current-password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={!password || login.isPending}>
                {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                로그인
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Renders children only for admins; otherwise shows the login form. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { data, isLoading } = useGetAuthMe({ query: { queryKey: getGetAuthMeQueryKey() } });
  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.isAdmin) return <LoginForm />;
  return <>{children}</>;
}

export function LogoutButton() {
  const queryClient = useQueryClient();
  const logout = useAdminLogout();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={logout.isPending}
      onClick={() =>
        logout.mutate(undefined, {
          onSuccess: (status) => {
            queryClient.setQueryData(getGetAuthMeQueryKey(), status);
            queryClient.removeQueries({
              predicate: (q) => q.queryKey[0] !== getGetAuthMeQueryKey()[0],
            });
          },
        })
      }
    >
      <LogOut className="mr-2 h-4 w-4" />
      로그아웃
    </Button>
  );
}
