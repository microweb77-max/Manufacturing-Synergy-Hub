import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useListCompanyClaims, getListCompanyClaimsQueryKey, useReviewCompanyClaim, getGetCompanyMembershipQueryKey, getGetCompanyVerificationQueryKey, getListMyCompaniesQueryKey, type CompanyClaimReview } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/adminAuth";
import { WriteGuard } from "@/pages/auth";
import { errMsg, effectiveStatus, STATUS_LABEL, fmtDate, openEvidence } from "@/components/membership-common";

function ClaimRow({ c }: { c: CompanyClaimReview }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const review = useReviewCompanyClaim();
  const [note, setNote] = useState("");
  const st = effectiveStatus(c.status, c.expiresAt);
  const decide = (decision: "approve" | "reject") => {
    if (!note.trim()) { toast({ title: "검토 의견을 입력하세요", variant: "destructive" }); return; }
    review.mutate({ id: c.id, data: { decision, note: note.trim() } }, {
      onSuccess: () => {
        toast({ title: decision === "approve" ? "승인했습니다" : "반려했습니다" });
        qc.invalidateQueries({ queryKey: getListCompanyClaimsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetCompanyMembershipQueryKey(c.companyId) });
        qc.invalidateQueries({ queryKey: getGetCompanyVerificationQueryKey(c.companyId) });
        qc.invalidateQueries({ queryKey: getListMyCompaniesQueryKey() });
      },
      onError: (e) => toast({ title: "처리 실패", description: errMsg(e), variant: "destructive" }),
    });
  };
  const matches = c.taxCode && c.registeredTaxCode ? c.taxCode.replace(/\D/g, "") === c.registeredTaxCode.replace(/\D/g, "") : null;
  return (
    <Card data-testid={`card-claim-${c.id}`}><CardContent className="py-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><Link href={`/companies/${c.companyId}`} className="font-semibold text-primary">{c.companyName}</Link>
          <div className="text-xs text-muted-foreground font-mono break-all">신청 계정: {c.userId}</div></div>
        <div className="flex gap-2"><Badge variant="outline">{c.method === "email" ? "이메일" : "수동"}</Badge><Badge>{STATUS_LABEL[st] ?? st}</Badge></div>
      </div>
      <div className="text-xs text-muted-foreground">만료: {fmtDate(c.expiresAt)}</div>
      {c.method === "manual" && (
        <div className="text-sm grid gap-1 md:grid-cols-2">
          <div>제출 MST: <span className="font-mono">{c.taxCode ?? "-"}</span></div>
          <div>등록된 MST: <span className="font-mono">{c.registeredTaxCode ?? "미등록"}</span> {matches !== null && <Badge variant={matches ? "secondary" : "destructive"}>{matches ? "일치" : "불일치"}</Badge>}</div>
          <Button size="sm" variant="outline" className="w-fit" data-testid={`button-evidence-${c.id}`} onClick={() => openEvidence(c.id).catch((e) => toast({ title: "다운로드 실패", description: errMsg(e), variant: "destructive" }))}>증빙 파일 다운로드</Button>
        </div>
      )}
      {c.reviewNote && <p className="text-sm">검토 의견: {c.reviewNote}</p>}
      {st === "pending" && c.method === "manual" && (
        <div className="space-y-2 border-t pt-3">
          <Textarea rows={2} maxLength={1000} placeholder="검토 의견 (필수)" value={note} onChange={(e) => setNote(e.target.value)} data-testid={`input-note-${c.id}`} />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={review.isPending} onClick={() => decide("reject")} data-testid={`button-reject-${c.id}`}>반려</Button>
            <Button disabled={review.isPending} onClick={() => decide("approve")} data-testid={`button-approve-${c.id}`}>승인</Button>
          </div>
        </div>
      )}
    </CardContent></Card>
  );
}

function ClaimsInner() {
  const { isAdmin } = useAdminAuth();
  const { data, isLoading, isError, refetch } = useListCompanyClaims({ query: { enabled: isAdmin, queryKey: getListCompanyClaimsQueryKey(), staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000 } });
  const sorted = [...(data ?? [])].sort((a, b) => Number(effectiveStatus(b.status, b.expiresAt) === "pending") - Number(effectiveStatus(a.status, a.expiresAt) === "pending") || b.id - a.id);
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">회사 인증 요청 검토</h1>
      {isLoading ? <Skeleton className="h-40 w-full" /> : isError ? (
        <div className="space-y-2"><p className="text-destructive">요청 목록을 불러오지 못했습니다.</p><Button variant="outline" onClick={() => refetch()}>다시 시도</Button></div>
      ) : sorted.length === 0 ? <p className="text-muted-foreground py-10 text-center">검토할 요청이 없습니다.</p>
        : sorted.map((c) => <ClaimRow key={c.id} c={c} />)}
    </div>
  );
}

export default function CompanyClaimsPage() {
  return <WriteGuard><ClaimsInner /></WriteGuard>;
}
