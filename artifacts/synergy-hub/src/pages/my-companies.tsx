import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useListMyCompanies, getListMyCompaniesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAuth } from "@/lib/adminAuth";
import { ROLE_LABEL } from "@/components/membership-common";

export default function MyCompaniesPage() {
  const { isSignedIn, userId, isLoaded } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { data, isLoading, isError, refetch } = useListMyCompanies({ query: { enabled: !!isSignedIn, queryKey: [...getListMyCompaniesQueryKey(), userId ?? null], staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000 } });
  if (isLoaded && !isSignedIn) return (
    <div className="p-8 space-y-3"><p>로그인이 필요합니다.</p><Link href="/sign-in"><Button>로그인</Button></Link></div>
  );
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">내 회사</h1>
        {isAdmin && <Link href="/company-claims"><Button variant="outline" data-testid="link-claims-review">인증 요청 검토</Button></Link>}
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : isError ? (
        <div className="space-y-2"><p className="text-destructive">목록을 불러오지 못했습니다.</p><Button variant="outline" onClick={() => refetch()}>다시 시도</Button></div>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-muted-foreground">아직 연결된 회사가 없습니다. 기업 목록에서 회사 프로필을 찾아 인증을 요청하세요.</p>
          <Link href="/companies"><Button>기업 목록 보기</Button></Link>
        </CardContent></Card>
      ) : data.map((c) => (
        <Card key={c.companyId} data-testid={`card-mycompany-${c.companyId}`}><CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
          <div><Link href={`/companies/${c.companyId}`} className="font-semibold text-primary">{c.name}</Link>
            <div className="mt-1"><Badge variant="secondary">{ROLE_LABEL[c.role]}</Badge></div></div>
          <div className="flex gap-2">
            <Link href={`/companies/${c.companyId}`}><Button size="sm" variant="outline">프로필</Button></Link>
            <Link href={`/my-companies/${c.companyId}/activity`}><Button size="sm">활동 관리</Button></Link>
          </div>
        </CardContent></Card>
      ))}
    </div>
  );
}
