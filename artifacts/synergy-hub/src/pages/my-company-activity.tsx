import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCompanyMembership, getGetCompanyMembershipQueryKey, useListMyCompanies, getListMyCompaniesQueryKey,
  useListProjects, getListProjectsQueryKey, getGetProjectQueryKey, useCreateProject, useUpdateProject, useDeleteProject,
  useListSupplyOffers, getListSupplyOffersQueryKey, useCreateSupplyOffer, useUpdateSupplyOffer, useDeleteSupplyOffer,
  useListTalentPosts, getListTalentPostsQueryKey, useCreateTalentPost, useUpdateTalentPost, useDeleteTalentPost,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { errMsg } from "@/components/membership-common";

type Vals = Record<string, string>;
interface Field { key: string; label: string; type?: "text" | "textarea" | "number" | "select"; options?: [string, string][]; required?: boolean; }

function RecordDialog({ open, title, fields, initial, pending, onClose, onSubmit }: {
  open: boolean; title: string; fields: Field[]; initial: Vals; pending: boolean; onClose: () => void; onSubmit: (v: Vals) => void;
}) {
  const [vals, setVals] = useState<Vals>(initial);
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const missing = fields.find((f) => f.required && !(vals[f.key] ?? "").trim());
    if (missing) { setErr(`${missing.label}을(를) 입력하세요`); return; }
    setErr(null); onSubmit(vals);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}{f.required && " *"}</Label>
              {f.type === "textarea" ? <Textarea rows={3} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} data-testid={`input-${f.key}`} />
                : f.type === "select" ? (
                  <Select value={vals[f.key] ?? ""} onValueChange={(v) => setVals({ ...vals, [f.key]: v })}>
                    <SelectTrigger data-testid={`select-${f.key}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{f.options!.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <Input type={f.type === "number" ? "number" : "text"} value={vals[f.key] ?? ""} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} data-testid={`input-${f.key}`} />}
            </div>
          ))}
          {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>취소</Button><Button onClick={submit} disabled={pending} data-testid="button-submit-record">{pending ? "저장 중..." : "저장"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface Row { id: number; title: string; sub: string; vals: Vals }

function Section({ title, rows, loading, fields, onCreate, onUpdate, onDelete, pending, testKey }: {
  title: string; rows: Row[]; loading: boolean; fields: Field[]; pending: boolean; testKey: string;
  onCreate: (v: Vals, done: () => void) => void; onUpdate: (id: number, v: Vals, done: () => void) => void; onDelete: (id: number, done: () => void) => void;
}) {
  const [dlg, setDlg] = useState<{ id: number | null; vals: Vals } | null>(null);
  const [del, setDel] = useState<Row | null>(null);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{title}</CardTitle>
        <Button size="sm" onClick={() => setDlg({ id: null, vals: {} })} data-testid={`button-new-${testKey}`}><Plus className="w-4 h-4 mr-1" /> 등록</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <Skeleton className="h-16 w-full" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">등록한 항목이 없습니다.</p> : rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 border rounded-md p-3" data-testid={`row-${testKey}-${r.id}`}>
            <div className="min-w-0"><div className="font-medium truncate">{r.title}</div><div className="text-xs text-muted-foreground truncate">{r.sub}</div></div>
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => setDlg({ id: r.id, vals: r.vals })} data-testid={`button-edit-${testKey}-${r.id}`}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setDel(r)} data-testid={`button-delete-${testKey}-${r.id}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </CardContent>
      {dlg && <RecordDialog open title={dlg.id ? `${title} 수정` : `${title} 등록`} fields={fields} initial={dlg.vals} pending={pending} onClose={() => setDlg(null)}
        onSubmit={(v) => dlg.id ? onUpdate(dlg.id, v, () => setDlg(null)) : onCreate(v, () => setDlg(null))} />}
      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>삭제할까요?</AlertDialogTitle><AlertDialogDescription>「{del?.title}」 항목이 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => del && onDelete(del.id, () => setDel(null))} data-testid="button-confirm-delete">삭제</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

const list = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
const opt = (s?: string) => s?.trim() ?? "";

const PROJECT_FIELDS: Field[] = [
  { key: "title", label: "제목", required: true }, { key: "category", label: "분류" },
  { key: "description", label: "설명", type: "textarea" }, { key: "requiredTags", label: "필요 역량 태그 (쉼표 구분)" },
  { key: "budget", label: "예산" }, { key: "deadline", label: "마감일 (YYYY-MM-DD)" },
];
const OFFER_FIELDS: Field[] = [
  { key: "itemName", label: "품목명", required: true }, { key: "category", label: "분류" },
  { key: "unitPrice", label: "단가" }, { key: "unit", label: "단위" }, { key: "currency", label: "통화" },
  { key: "minOrderQty", label: "최소 주문 수량" }, { key: "description", label: "설명", type: "textarea" },
];
const TALENT_FIELDS: Field[] = [
  { key: "postType", label: "구분", type: "select", options: [["hiring", "구인"], ["seeking", "구직"]], required: true },
  { key: "title", label: "제목", required: true }, { key: "position", label: "직무" }, { key: "location", label: "근무지" },
  { key: "employmentType", label: "고용 형태" }, { key: "experienceLevel", label: "경력" }, { key: "headcount", label: "인원", type: "number" },
  { key: "skills", label: "스킬 (쉼표 구분)" }, { key: "description", label: "설명", type: "textarea" },
  { key: "contactEmail", label: "연락 이메일" }, { key: "contactPhone", label: "연락 전화" },
];

export default function MyCompanyActivityPage() {
  const [, params] = useRoute("/my-companies/:id/activity");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { isSignedIn, userId } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: m, isLoading: mLoading, isError } = useGetCompanyMembership(id, { query: { enabled: !!isSignedIn && !!id, queryKey: [...getGetCompanyMembershipQueryKey(id), userId ?? null], staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000 } });
  const { data: mine } = useListMyCompanies({ query: { enabled: !!isSignedIn, queryKey: [...getListMyCompaniesQueryKey(), userId ?? null] } });
  const allowed = !!m && m.verified && m.role !== null;
  const companyName = mine?.find((c) => c.companyId === id)?.name ?? "";

  const projects = useListProjects(undefined, { query: { enabled: allowed, queryKey: getListProjectsQueryKey() } });
  const offers = useListSupplyOffers(undefined, { query: { enabled: allowed, queryKey: getListSupplyOffersQueryKey() } });
  const talent = useListTalentPosts(undefined, { query: { enabled: allowed, queryKey: getListTalentPostsQueryKey() } });

  const cP = useCreateProject(), uP = useUpdateProject(), dP = useDeleteProject();
  const cO = useCreateSupplyOffer(), uO = useUpdateSupplyOffer(), dO = useDeleteSupplyOffer();
  const cT = useCreateTalentPost(), uT = useUpdateTalentPost(), dT = useDeleteTalentPost();

  if (!isSignedIn) return <div className="p-8 space-y-3"><p>로그인이 필요합니다.</p><Link href="/sign-in"><Button>로그인</Button></Link></div>;
  if (mLoading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
  if (isError || !allowed) return (
    <div className="p-8 space-y-3"><p data-testid="text-activity-denied">이 회사의 활동을 관리할 권한이 없거나 아직 인증되지 않았습니다.</p><Link href={`/companies/${id}`} className="text-primary">회사 프로필로 이동</Link></div>
  );

  const ok = (msg: string, done: () => void, keys: readonly (readonly unknown[])[]) => () => {
    toast({ title: msg }); keys.forEach((k) => qc.invalidateQueries({ queryKey: k as unknown[] })); done();
  };
  const fail = (e: unknown) => toast({ title: "요청 실패", description: errMsg(e), variant: "destructive" });

  const pRows: Row[] = (projects.data ?? []).filter((p) => p.ownerCompanyId === id).map((p) => ({
    id: p.id, title: p.title, sub: `${p.category} · ${p.status}`,
    vals: { title: p.title, category: p.category, description: p.description, requiredTags: p.requiredTags.join(", "), budget: p.budget ?? "", deadline: p.deadline ? p.deadline.slice(0, 10) : "" },
  }));
  const oRows: Row[] = (offers.data ?? []).filter((o) => o.companyId === id).map((o) => ({
    id: o.id, title: o.itemName, sub: `${o.category} · ${o.unitPrice} ${o.currency}`,
    vals: { itemName: o.itemName, category: o.category, unitPrice: o.unitPrice, unit: o.unit, currency: o.currency, minOrderQty: o.minOrderQty, description: o.description },
  }));
  const tRows: Row[] = (talent.data ?? []).filter((t) => t.ownerCompanyId === id).map((t) => ({
    id: t.id, title: t.title, sub: `${t.postType === "hiring" ? "구인" : "구직"} · ${t.position}`,
    vals: { postType: t.postType, title: t.title, position: t.position, location: t.location, employmentType: t.employmentType ?? "", experienceLevel: t.experienceLevel ?? "", headcount: t.headcount != null ? String(t.headcount) : "", skills: t.skills.join(", "), description: t.description, contactEmail: t.contactEmail ?? "", contactPhone: t.contactPhone ?? "" },
  }));

  const projBody = (v: Vals) => ({ title: v.title.trim(), category: v.category ?? "", description: v.description ?? "", requiredTags: list(v.requiredTags ?? ""), budget: opt(v.budget), deadline: opt(v.deadline) });
  const offerBody = (v: Vals) => ({ itemName: v.itemName.trim(), category: opt(v.category), unitPrice: opt(v.unitPrice), unit: opt(v.unit), currency: opt(v.currency), minOrderQty: opt(v.minOrderQty), description: opt(v.description) });
  const talentBody = (v: Vals) => ({
    postType: (v.postType === "seeking" ? "seeking" : "hiring") as "hiring" | "seeking", title: v.title.trim(),
    position: opt(v.position), location: opt(v.location), employmentType: opt(v.employmentType), experienceLevel: opt(v.experienceLevel),
    headcount: v.headcount && v.headcount.trim() ? Number(v.headcount) : null, skills: list(v.skills ?? ""), description: opt(v.description),
    contactEmail: opt(v.contactEmail), contactPhone: opt(v.contactPhone),
  });

  const pKeys = [getListProjectsQueryKey()];
  const oKeys = [getListSupplyOffersQueryKey()];
  const tKeys = [getListTalentPostsQueryKey()];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href={`/companies/${id}`} className="text-sm text-primary">&larr; 회사 프로필</Link>
        <h1 className="text-2xl font-bold mt-1">{companyName || `회사 #${id}`} 활동 관리</h1>
        <p className="text-sm text-muted-foreground">이 회사가 소유한 프로젝트, 공급 제안, 인재 공고만 표시됩니다.</p>
      </div>

      <Section title="프로젝트" testKey="project" rows={pRows} loading={projects.isLoading} fields={PROJECT_FIELDS} pending={cP.isPending || uP.isPending || dP.isPending}
        onCreate={(v, done) => cP.mutate({ data: { ownerCompanyId: id, demandCompany: companyName, ...projBody(v) } }, { onSuccess: ok("프로젝트를 등록했습니다", done, pKeys), onError: fail })}
        onUpdate={(rid, v, done) => uP.mutate({ id: rid, data: projBody(v) }, { onSuccess: ok("프로젝트를 수정했습니다", done, [...pKeys, getGetProjectQueryKey(rid)]), onError: fail })}
        onDelete={(rid, done) => dP.mutate({ id: rid }, { onSuccess: ok("프로젝트를 삭제했습니다", done, [...pKeys, getGetProjectQueryKey(rid)]), onError: fail })} />

      <Section title="공급 제안" testKey="offer" rows={oRows} loading={offers.isLoading} fields={OFFER_FIELDS} pending={cO.isPending || uO.isPending || dO.isPending}
        onCreate={(v, done) => cO.mutate({ data: { companyId: id, ...offerBody(v) } }, { onSuccess: ok("공급 제안을 등록했습니다", done, oKeys), onError: fail })}
        onUpdate={(rid, v, done) => uO.mutate({ id: rid, data: offerBody(v) }, { onSuccess: ok("공급 제안을 수정했습니다", done, oKeys), onError: fail })}
        onDelete={(rid, done) => dO.mutate({ id: rid }, { onSuccess: ok("공급 제안을 삭제했습니다", done, oKeys), onError: fail })} />

      <Section title="인재 공고" testKey="talent" rows={tRows} loading={talent.isLoading} fields={TALENT_FIELDS} pending={cT.isPending || uT.isPending || dT.isPending}
        onCreate={(v, done) => cT.mutate({ data: { ownerCompanyId: id, authorName: companyName, ...talentBody(v) } }, { onSuccess: ok("인재 공고를 등록했습니다", done, tKeys), onError: fail })}
        onUpdate={(rid, v, done) => uT.mutate({ id: rid, data: talentBody(v) }, { onSuccess: ok("인재 공고를 수정했습니다", done, tKeys), onError: fail })}
        onDelete={(rid, done) => dT.mutate({ id: rid }, { onSuccess: ok("인재 공고를 삭제했습니다", done, tKeys), onError: fail })} />
    </div>
  );
}
