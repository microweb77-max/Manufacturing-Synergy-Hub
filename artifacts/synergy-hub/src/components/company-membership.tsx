import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCompanyVerification, getGetCompanyVerificationQueryKey,
  useGetCompanyMembership, getGetCompanyMembershipQueryKey,
  useCreateCompanyClaim, useCancelCompanyClaim,
  useInviteCompanyMember, useCancelCompanyInvitation, useRemoveCompanyMember,
  useUpdateCompany, getGetCompanyQueryKey, getListCompaniesQueryKey, getListMyCompaniesQueryKey,
  type Company,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/adminAuth";
import { basePath } from "@/lib/clerk";
import { BadgeCheck, ShieldQuestion, Mail, FileUp, Trash2, UserPlus, Pencil, Activity } from "lucide-react";
import { errMsg, effectiveStatus, STATUS_LABEL, ROLE_LABEL, fmtDate } from "./membership-common";

export function VerificationBadge({ companyId }: { companyId: number }) {
  const { data } = useGetCompanyVerification(companyId, { query: { enabled: !!companyId, queryKey: getGetCompanyVerificationQueryKey(companyId), staleTime: 30_000, refetchOnWindowFocus: true } });
  if (!data) return null;
  return data.verified ? (
    <Badge data-testid="badge-verified" className="bg-emerald-600 text-white hover:bg-emerald-600"><BadgeCheck className="w-3 h-3 mr-1" /> 인증된 회사</Badge>
  ) : (
    <Badge data-testid="badge-unverified" variant="outline" className="text-muted-foreground"><ShieldQuestion className="w-3 h-3 mr-1" /> 미인증</Badge>
  );
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "application/pdf"];

export function CompanyMembershipPanel({ company }: { company: Company }) {
  const id = company.id;
  const { isSignedIn, userId } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const key = [...getGetCompanyMembershipQueryKey(id), userId ?? null] as const;
  const { data: m, isLoading, isError, error, refetch } = useGetCompanyMembership(id, {
    query: {
      enabled: !!isSignedIn && !!userId,
      queryKey: key,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: getGetCompanyMembershipQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetCompanyVerificationQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListMyCompaniesQueryKey() });
  };

  const createClaim = useCreateCompanyClaim();
  const cancelClaim = useCancelCompanyClaim();
  const invite = useInviteCompanyMember();
  const cancelInv = useCancelCompanyInvitation();
  const removeMember = useRemoveCompanyMember();
  const update = useUpdateCompany();

  const [taxCode, setTaxCode] = useState("");
  const [evidence, setEvidence] = useState<{ name: string; data: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"company_admin" | "staff">("staff");
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; userId: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [mgmtError, setMgmtError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", location: "", tags: "", techSpecs: "", phone: "", kakaoTalkId: "", logoUrl: "" });

  if (!isSignedIn) {
    const href = `${basePath}/sign-in?forceRedirectUrl=${encodeURIComponent(`${basePath}/companies/${id}`)}`;
    return (
      <Card><CardContent className="py-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">이 회사의 담당자이신가요? 로그인 후 기존 프로필을 인증(클레임)할 수 있습니다.</p>
        <a href={href}><Button variant="outline" data-testid="button-login-claim">로그인하고 인증하기</Button></a>
      </CardContent></Card>
    );
  }
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (isError || !m) {
    return (
      <Card><CardContent className="py-6 flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">{errMsg(error, "회원 정보를 불러오지 못했습니다.")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>다시 시도</Button>
      </CardContent></Card>
    );
  }

  const isMember = m.role !== null;
  const isCompanyAdmin = m.role === "company_admin";
  const canEdit = m.verified && isCompanyAdmin;
  const canInvite = isCompanyAdmin;
  const canManage = isCompanyAdmin || isAdmin;
  const claims = [...m.claims].sort((a, b) => b.id - a.id);
  const hasPending = claims.some((c) => effectiveStatus(c.status, c.expiresAt) === "pending");

  const onFile = (f: File | undefined) => {
    if (!f) return setEvidence(null);
    if (!ALLOWED.includes(f.type)) { toast({ title: "PNG, JPG, PDF 파일만 가능합니다", variant: "destructive" }); return; }
    if (f.size > MAX_BYTES) { toast({ title: "파일은 5MB 이하여야 합니다", variant: "destructive" }); return; }
    const r = new FileReader();
    r.onload = () => setEvidence({ name: f.name, data: String(r.result) });
    r.onerror = () => toast({ title: "파일을 읽지 못했습니다", variant: "destructive" });
    r.readAsDataURL(f);
  };

  const submitEmail = () => createClaim.mutate({ data: { companyId: id, method: "email" } }, {
    onSuccess: () => { toast({ title: "인증 메일을 보냈습니다", description: "등록된 회사 이메일로 30분간 유효한 링크가 발송되었습니다." }); refreshAll(); },
    onError: (e) => toast({ title: "요청 실패", description: errMsg(e), variant: "destructive" }),
  });
  const submitManual = () => {
    if (!taxCode.trim() || !evidence) { toast({ title: "사업자번호(MST)와 증빙 파일을 입력하세요", variant: "destructive" }); return; }
    createClaim.mutate({ data: { companyId: id, method: "manual", taxCode: taxCode.trim(), evidenceData: evidence.data } }, {
      onSuccess: () => { toast({ title: "수동 인증 요청을 제출했습니다", description: "플랫폼 관리자가 검토합니다." }); setTaxCode(""); setEvidence(null); refreshAll(); },
      onError: (e) => toast({ title: "제출 실패", description: errMsg(e), variant: "destructive" }),
    });
  };

  const startEdit = () => {
    setForm({ name: company.name, description: company.description, location: company.location, tags: company.capabilityTags.join(", "), techSpecs: company.techSpecs, phone: company.phone ?? "", kakaoTalkId: company.kakaoTalkId ?? "", logoUrl: company.logoUrl ?? "" });
    setEditing(true);
  };
  const saveEdit = () => {
    if (!form.name.trim()) { toast({ title: "회사명을 입력하세요", variant: "destructive" }); return; }
    update.mutate({ id, data: {
      name: form.name.trim(), description: form.description, location: form.location,
      capabilityTags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      techSpecs: form.techSpecs, phone: form.phone, kakaoTalkId: form.kakaoTalkId, logoUrl: form.logoUrl,
    } }, {
      onSuccess: () => {
        toast({ title: "프로필을 저장했습니다" });
        qc.invalidateQueries({ queryKey: getGetCompanyQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        qc.invalidateQueries({ queryKey: getListMyCompaniesQueryKey() });
        setEditing(false);
      },
      onError: (e) => toast({ title: "저장 실패", description: errMsg(e), variant: "destructive" }),
    });
  };
  const f = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="space-y-4" data-testid="panel-membership">
      {isMember && (
        <Card>
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">내 역할: <Badge variant="secondary">{ROLE_LABEL[m.role as string]}</Badge> {!m.verified && <span className="text-muted-foreground ml-2">회사 인증 대기 중</span>}</div>
            <div className="flex gap-2">
              {m.verified && <Link href={`/my-companies/${id}/activity`}><Button size="sm" variant="outline" data-testid="link-activity"><Activity className="w-4 h-4 mr-1" /> 활동 관리</Button></Link>}
              {canEdit && !editing && <Button size="sm" onClick={startEdit} data-testid="button-edit-profile"><Pencil className="w-4 h-4 mr-1" /> 프로필 수정</Button>}
            </div>
          </CardContent>
        </Card>
      )}

      {editing && canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-lg">프로필 수정</CardTitle><CardDescription>이메일, 사업자번호, 신뢰 점수 등 인증 정보는 수정할 수 없습니다.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>회사명</Label><Input {...f("name")} data-testid="input-edit-name" /></div>
              <div className="space-y-1"><Label>위치</Label><Input {...f("location")} /></div>
              <div className="space-y-1"><Label>전화</Label><Input {...f("phone")} /></div>
              <div className="space-y-1"><Label>카카오톡 ID</Label><Input {...f("kakaoTalkId")} /></div>
              <div className="space-y-1 md:col-span-2"><Label>로고 URL</Label><Input {...f("logoUrl")} /></div>
              <div className="space-y-1 md:col-span-2"><Label>역량 태그 (쉼표 구분)</Label><Input {...f("tags")} /></div>
            </div>
            <div className="space-y-1"><Label>소개</Label><Textarea rows={3} {...f("description")} /></div>
            <div className="space-y-1"><Label>기술 스펙</Label><Textarea rows={4} {...f("techSpecs")} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)}>취소</Button>
              <Button onClick={saveEdit} disabled={update.isPending} data-testid="button-save-profile">{update.isPending ? "저장 중..." : "저장"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!m.verified && (
        <Card>
          <CardHeader><CardTitle className="text-lg">회사 프로필 인증</CardTitle><CardDescription>새 프로필을 만들지 않고 기존 프로필을 내 계정에 연결합니다.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {hasPending && <p className="text-sm text-muted-foreground">진행 중인 요청이 있습니다. 새 요청을 제출하면 이전 요청은 대체됩니다.</p>}
            <Tabs defaultValue="email">
              <TabsList><TabsTrigger value="email">이메일 인증</TabsTrigger><TabsTrigger value="manual">수동 인증</TabsTrigger></TabsList>
              <TabsContent value="email" className="space-y-3 pt-3">
                <p className="text-sm text-muted-foreground">프로필에 등록된 회사 이메일로만 인증 링크가 발송되며, 링크는 30분간 유효합니다. 이메일 주소는 입력하지 않습니다.</p>
                <Button onClick={submitEmail} disabled={createClaim.isPending} data-testid="button-claim-email"><Mail className="w-4 h-4 mr-2" /> 등록된 이메일로 링크 받기</Button>
              </TabsContent>
              <TabsContent value="manual" className="space-y-3 pt-3">
                <div className="space-y-1"><Label>사업자등록번호 (MST)</Label><Input value={taxCode} onChange={(e) => setTaxCode(e.target.value)} data-testid="input-claim-mst" /></div>
                <div className="space-y-1"><Label>증빙 파일 (PNG/JPG/PDF, 5MB 이하)</Label>
                  <Input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => onFile(e.target.files?.[0])} data-testid="input-claim-file" />
                  {evidence && <p className="text-xs text-muted-foreground">{evidence.name}</p>}
                </div>
                <Button onClick={submitManual} disabled={createClaim.isPending} data-testid="button-claim-manual"><FileUp className="w-4 h-4 mr-2" /> 검토 요청 제출</Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {claims.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">내 인증 요청</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {claims.map((c) => {
              const st = effectiveStatus(c.status, c.expiresAt);
              return (
                <div key={c.id} className="border rounded-md p-3 flex flex-wrap items-center justify-between gap-2" data-testid={`row-claim-${c.id}`}>
                  <div className="text-sm space-y-0.5">
                    <div className="flex items-center gap-2"><Badge variant="outline">{c.method === "email" ? "이메일" : "수동"}</Badge><span className="font-medium" data-testid={`status-claim-${c.id}`}>{STATUS_LABEL[st] ?? st}</span></div>
                    <div className="text-xs text-muted-foreground">만료: {fmtDate(c.expiresAt)}</div>
                    {c.reviewNote && <div className="text-xs">검토 의견: {c.reviewNote}</div>}
                  </div>
                  {st === "pending" && (
                    <Button size="sm" variant="outline" disabled={cancelClaim.isPending} data-testid={`button-cancel-claim-${c.id}`}
                      onClick={() => cancelClaim.mutate({ id: c.id }, {
                        onSuccess: () => { toast({ title: "요청을 취소했습니다" }); refreshAll(); },
                        onError: (e) => toast({ title: "취소 실패", description: errMsg(e), variant: "destructive" }),
                      })}>요청 취소</Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader><CardTitle className="text-lg">구성원 관리</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {mgmtError && <p className="text-sm text-destructive border border-destructive/30 rounded-md p-2" role="alert" data-testid="text-mgmt-error">{mgmtError}</p>}
            <div className="space-y-2">
              {m.members.length === 0 && <p className="text-sm text-muted-foreground">구성원이 없습니다.</p>}
              {m.members.map((mem) => (
                <div key={mem.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3" data-testid={`row-member-${mem.id}`}>
                  <div className="text-sm min-w-0"><div className="font-mono text-xs break-all">{mem.userId}{mem.userId === userId && " (나)"}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[mem.role]} · {fmtDate(mem.createdAt)}</div></div>
                  <Button size="sm" variant="outline" onClick={() => { setMgmtError(null); setRemoveTarget({ id: mem.id, userId: mem.userId }); }} data-testid={`button-remove-member-${mem.id}`}><Trash2 className="w-4 h-4 mr-1" /> 제거</Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">대기 중인 초대</h4>
              {m.invitations.length === 0 && <p className="text-sm text-muted-foreground">대기 중인 초대가 없습니다.</p>}
              {m.invitations.map((inv) => {
                const st = effectiveStatus(inv.status, inv.expiresAt);
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-3" data-testid={`row-invitation-${inv.id}`}>
                    <div className="text-sm"><div>{inv.email}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[inv.role]} · {STATUS_LABEL[st] ?? st} · 만료 {fmtDate(inv.expiresAt)}</div></div>
                    {st === "pending" && (isCompanyAdmin) && <Button size="sm" variant="outline" disabled={cancelInv.isPending} data-testid={`button-cancel-invitation-${inv.id}`}
                      onClick={() => cancelInv.mutate({ id, invitationId: inv.id }, {
                        onSuccess: () => { toast({ title: "초대를 취소했습니다" }); refreshAll(); },
                        onError: (e) => setMgmtError(errMsg(e)),
                      })}>초대 취소</Button>}
                  </div>
                );
              })}
            </div>

            {canInvite ? (
              <div className="space-y-2 border-t pt-4">
                <h4 className="text-sm font-semibold">구성원 초대</h4>
                <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                  <Input type="email" placeholder="초대할 이메일" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} data-testid="input-invite-email" />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "company_admin" | "staff")}>
                    <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="staff">직원</SelectItem><SelectItem value="company_admin">회사 관리자</SelectItem></SelectContent>
                  </Select>
                  <Button disabled={!inviteEmail.includes("@")} onClick={() => { setMgmtError(null); setConfirmInvite(true); }} data-testid="button-invite"><UserPlus className="w-4 h-4 mr-1" /> 초대</Button>
                </div>
              </div>
            ) : <p className="text-xs text-muted-foreground border-t pt-3">플랫폼 관리자는 조회와 제거만 가능하며, 초대는 해당 회사의 회사 관리자 역할일 때만 가능합니다.</p>}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmInvite} onOpenChange={setConfirmInvite}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>초대 메일을 발송할까요?</AlertDialogTitle>
            <AlertDialogDescription>{inviteEmail} 에게 {ROLE_LABEL[inviteRole]} 역할 초대 링크를 발송합니다.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-invite" onClick={() => invite.mutate({ id, data: { email: inviteEmail.trim(), role: inviteRole } }, {
              onSuccess: () => { toast({ title: "초대를 발송했습니다" }); setInviteEmail(""); refreshAll(); },
              onError: (e) => setMgmtError(errMsg(e, "초대 발송에 실패했습니다.")),
            })}>발송</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>구성원을 제거할까요?</AlertDialogTitle>
            <AlertDialogDescription>{removeTarget?.userId} 계정의 이 회사 접근 권한이 사라집니다. 마지막 회사 관리자는 제거할 수 없습니다.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-remove" onClick={() => removeTarget && removeMember.mutate({ id, memberId: removeTarget.id }, {
              onSuccess: () => { toast({ title: "구성원을 제거했습니다" }); refreshAll(); },
              onError: (e) => setMgmtError(errMsg(e, "제거할 수 없습니다. 마지막 관리자일 수 있습니다.")),
            })}>제거</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
