import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTenders,
  getListTendersQueryKey,
  useListMyBookmarks,
  getListMyBookmarksQueryKey,
  useAddMyBookmark,
  useRemoveMyBookmark,
  useGetMyAlertPreferences,
  getGetMyAlertPreferencesQueryKey,
  usePutMyAlertPreferences,
  type TenderItem,
  type TenderSourceType,
  type ListTendersDeadlineWithin,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Megaphone, Bell, Star, Building2, ExternalLink, Filter, Clock, Lock, Wallet } from "lucide-react";

const ALL = "__all__";
const TYPES: { value: TenderSourceType; label: string; style: string }[] = [
  { value: "gov_vn", label: "베트남 정부 입찰", style: "bg-red-100 text-red-800" },
  { value: "kr_support", label: "한국 지원사업", style: "bg-blue-100 text-blue-800" },
  { value: "buyer_rfq", label: "대형 발주처 RFQ", style: "bg-emerald-100 text-emerald-800" },
];
const CATEGORIES = ["설비", "자동화", "IT·소프트웨어", "부품·소재", "건설·인프라", "서비스", "기타"];
const DEADLINES: { value: ListTendersDeadlineWithin; label: string }[] = [
  { value: "7", label: "7일 이내" },
  { value: "30", label: "30일 이내" },
  { value: "all", label: "전체" },
];
const typeOf = (v: string) => TYPES.find((t) => t.value === v);

function todayVietnam(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function dDay(deadline: string, today: string): { text: string; urgent: boolean; closed: boolean } {
  const diff = Math.round((Date.parse(deadline) - Date.parse(today)) / 86_400_000);
  if (diff < 0) return { text: "마감", urgent: false, closed: true };
  if (diff === 0) return { text: "D-Day", urgent: true, closed: false };
  return { text: `D-${diff}`, urgent: diff <= 7, closed: false };
}

const fmt = (d: string) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;

function AlertSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = { itemType: "tender" as const };
  const { data } = useGetMyAlertPreferences(params, {
    query: { queryKey: getGetMyAlertPreferencesQueryKey(params), enabled: open },
  });
  const save = usePutMyAlertPreferences();
  const [draft, setDraft] = useState<{ categories: string[]; weeklyEmail: boolean; email: string } | null>(null);
  const categories = draft?.categories ?? data?.categories ?? [];
  const weeklyEmail = draft?.weeklyEmail ?? data?.weeklyEmail ?? false;
  const availableEmails = data?.availableEmails ?? [];
  const savedEmail = data?.email && availableEmails.includes(data.email) ? data.email : "";
  const email = draft?.email ?? savedEmail ?? "";
  const edit = (patch: Partial<{ categories: string[]; weeklyEmail: boolean; email: string }>) =>
    setDraft({ categories, weeklyEmail, email, ...patch });
  const toggle = (v: string, on: boolean) => edit({ categories: on ? [...categories, v] : categories.filter((x) => x !== v) });

  const submit = () => {
    save.mutate(
      { data: { itemType: "tender", categories, weeklyEmail, ...(email.trim() ? { email: email.trim() } : {}) } },
      {
        onSuccess: () => {
          toast({ title: "알림 설정 저장", description: weeklyEmail ? "매주 새 공고 요약과 마감 3일 전 안내를 보내드립니다." : "주간 메일이 꺼져 있습니다." });
          qc.invalidateQueries({ queryKey: getGetMyAlertPreferencesQueryKey(params) });
          setDraft(null);
          onOpenChange(false);
        },
        onError: () => toast({ title: "오류", description: "저장하지 못했습니다. 인증된 이메일인지 확인해 주세요.", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setDraft(null); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />공고 알림 설정</DialogTitle>
          <DialogDescription>관심 유형·분야의 새 공고를 주 1회 메일로 요약하고, 관심등록한 공고는 마감 3일 전에 한 번 안내합니다. 유형이나 분야를 하나도 고르지 않은 쪽은 제한 없이 받습니다(둘 다 비우면 신규 공고 메일은 없음).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-medium mb-2">유형</p>
            <div className="space-y-2">
              {TYPES.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={categories.includes(t.value)} onCheckedChange={(v) => toggle(t.value, !!v)} />{t.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">분야</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={categories.includes(c)} onCheckedChange={(v) => toggle(c, !!v)} />{c}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="tender-weekly-email">주간 메일 받기</Label>
            <Switch id="tender-weekly-email" checked={weeklyEmail} onCheckedChange={(v) => edit({ weeklyEmail: v })} />
          </div>
          {weeklyEmail && (
            <div className="space-y-1">
              <Label htmlFor="tender-alert-email">받을 이메일 <span className="text-muted-foreground font-normal">(계정에 인증된 이메일만 선택 가능)</span></Label>
              {availableEmails.length > 0 ? (
                <select
                  id="tender-alert-email"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={email}
                  onChange={(e) => edit({ email: e.target.value })}
                >
                  <option value="">기본 이메일 ({availableEmails[0]})</option>
                  {availableEmails.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">인증된 이메일이 없어 알림을 켤 수 없습니다.</p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={save.isPending || (weeklyEmail && availableEmails.length === 0)}>저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 whitespace-pre-wrap">{children}</dd></div>;
}

function TenderDetailDialog({ tender, onClose }: { tender: TenderItem | null; onClose: () => void }) {
  const today = todayVietnam();
  return (
    <Dialog open={!!tender} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {tender && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`${typeOf(tender.sourceType)?.style ?? ""} border-0`}>{typeOf(tender.sourceType)?.label}</Badge>
                <Badge variant="outline">{tender.category}</Badge>
              </div>
              <DialogTitle className="text-xl leading-snug">{tender.title}</DialogTitle>
              {tender.originalTitle && <DialogDescription className="italic">{tender.originalTitle}</DialogDescription>}
            </DialogHeader>
            <dl className="space-y-2 text-sm">
              {tender.buyer && <Row label="발주처">{tender.buyer}</Row>}
              <Row label="마감일">{fmt(tender.deadline)} ({dDay(tender.deadline, today).text})</Row>
              {tender.publishedDate && <Row label="게시일">{fmt(tender.publishedDate)}</Row>}
              {(tender.country || tender.city) && <Row label="지역">{[tender.country, tender.city].filter(Boolean).join(" · ")}</Row>}
              {!tender.restricted && tender.budget && <Row label="예산">{tender.budget}</Row>}
              {!tender.restricted && tender.eligibility && <Row label="참가 자격">{tender.eligibility}</Row>}
              {!tender.restricted && tender.submission && <Row label="제출 방법">{tender.submission}</Row>}
            </dl>
            {tender.summary && <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{tender.summary}</p>}
            {tender.restricted ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-center space-y-2">
                <p className="text-muted-foreground flex items-center justify-center gap-1"><Lock className="h-4 w-4" />상세 요약·예산·참가 자격·제출 방법·원문 링크는 로그인 후 확인할 수 있습니다.</p>
                <Link href="/sign-in"><Button size="sm">로그인 후 확인</Button></Link>
              </div>
            ) : tender.sourceUrl && (
              <a href={tender.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                원문 보기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <p className="text-xs text-muted-foreground">공고 정보는 원문 기준이며 참고용입니다.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TendersPage() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [sourceType, setSourceType] = useState<string>(ALL);
  const [category, setCategory] = useState(ALL);
  const [within, setWithin] = useState<ListTendersDeadlineWithin>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  const params = {
    ...(sourceType !== ALL ? { sourceType: sourceType as TenderSourceType } : {}),
    ...(category !== ALL ? { category } : {}),
    deadlineWithin: within,
  };
  const { data: tenders, isLoading } = useListTenders(params, {
    // Signed-in and anonymous responses differ (server-side field removal): never share a cache entry.
    query: { queryKey: [...getListTendersQueryKey(params), isSignedIn === true] },
  });

  const bmParams = { itemType: "tender" as const };
  const bmKey = getListMyBookmarksQueryKey(bmParams);
  const { data: bookmarks } = useListMyBookmarks(bmParams, { query: { queryKey: bmKey, enabled: isSignedIn === true } });
  const bookmarked = useMemo(() => new Set((bookmarks ?? []).map((b) => b.itemId)), [bookmarks]);
  const add = useAddMyBookmark();
  const remove = useRemoveMyBookmark();

  const toggleBookmark = (t: TenderItem) => {
    if (!isSignedIn) return;
    const done = () => qc.invalidateQueries({ queryKey: bmKey });
    const fail = () => toast({ title: "오류", description: "관심 등록을 변경하지 못했습니다.", variant: "destructive" });
    if (bookmarked.has(t.id)) remove.mutate({ params: { itemType: "tender", itemId: t.id } }, { onSuccess: done, onError: fail });
    else add.mutate({ data: { itemType: "tender", itemId: t.id } }, { onSuccess: done, onError: fail });
  };

  const today = todayVietnam();
  const shown = tab === "mine" ? (tenders ?? []).filter((t) => bookmarked.has(t.id)) : tenders ?? [];
  const selected = (tenders ?? []).find((t) => t.id === selectedId) ?? null;
  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="h-7 w-7 text-primary" />사업공고</h1>
          <p className="mt-2 text-muted-foreground">베트남 정부 입찰, 한국 지원사업, 대형 발주처 공개 구매·협력사 모집 공고를 한곳에서 확인하세요.</p>
        </div>
        {isSignedIn ? (
          <Button variant="outline" onClick={() => setAlertOpen(true)}><Bell className="h-4 w-4 mr-1.5" />알림 설정</Button>
        ) : (
          <Link href="/sign-in"><Button variant="outline"><Bell className="h-4 w-4 mr-1.5" />로그인하고 알림 받기</Button></Link>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "mine")} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="mine">내 관심{isSignedIn && bookmarked.size ? ` (${bookmarked.size})` : ""}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <button className={chip(sourceType === ALL)} onClick={() => setSourceType(ALL)}>전체 유형</button>
          {TYPES.map((t) => <button key={t.value} className={chip(sourceType === t.value)} onClick={() => setSourceType(t.value)}>{t.label}</button>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <button className={chip(category === ALL)} onClick={() => setCategory(ALL)}>전체 분야</button>
          {CATEGORIES.map((c) => <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>{c}</button>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {DEADLINES.map((d) => <button key={d.value} className={chip(within === d.value)} onClick={() => setWithin(d.value)}>{d.label}</button>)}
        </div>
      </div>

      {tab === "mine" && !isSignedIn ? (
        <Card className="mt-6"><CardContent className="py-12 text-center space-y-3">
          <p className="text-muted-foreground">로그인하면 관심 공고를 모아 볼 수 있습니다.</p>
          <Link href="/sign-in"><Button>로그인</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          ) : shown.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-16 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">{tab === "mine" ? "관심 등록한 공고가 없습니다." : "조건에 맞는 공고가 없습니다."}</p>
            </CardContent></Card>
          ) : (
            shown.map((t) => {
              const dd = dDay(t.deadline, today);
              return (
                <Card key={t.id} className={`hover:shadow-md transition-shadow cursor-pointer ${dd.urgent ? "border-red-300" : ""}`} onClick={() => setSelectedId(t.id)} data-testid={`tender-card-${t.id}`}>
                  <CardContent className="p-4 flex gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`${typeOf(t.sourceType)?.style ?? ""} border-0`}>{typeOf(t.sourceType)?.label}</Badge>
                        <Badge variant={dd.urgent ? "destructive" : "outline"}>{dd.text}</Badge>
                      </div>
                      <h3 className="font-semibold leading-snug">{t.title}</h3>
                      {t.buyer && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{t.buyer}</p>}
                      <div className="flex gap-1 flex-wrap"><Badge variant="outline" className="text-xs">{t.category}</Badge></div>
                      <p className={`text-xs flex items-center gap-1 ${dd.urgent ? "text-red-600 font-medium" : "text-muted-foreground"}`}><Clock className="h-3 w-3 shrink-0" />마감 {fmt(t.deadline)}</p>
                      {!t.restricted && t.budget && <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3 shrink-0" />{t.budget}</p>}
                      {t.summary && <p className="text-sm text-foreground/70 line-clamp-2">{t.summary}</p>}
                    </div>
                    {isSignedIn ? (
                      <button
                        aria-label={bookmarked.has(t.id) ? "관심 해제" : "관심 등록"}
                        className="self-start p-1"
                        onClick={(ev) => { ev.stopPropagation(); toggleBookmark(t); }}
                      >
                        <Star className={`h-5 w-5 ${bookmarked.has(t.id) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                      </button>
                    ) : (
                      <Link href="/sign-in" onClick={(ev) => ev.stopPropagation()} aria-label="로그인하고 관심 등록" className="self-start p-1">
                        <Star className="h-5 w-5 text-muted-foreground/50" />
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground text-center">공고 정보는 원문 기준이며 참고용입니다.</p>

      <TenderDetailDialog tender={selected} onClose={() => setSelectedId(null)} />
      {isSignedIn && <AlertSettingsDialog open={alertOpen} onOpenChange={setAlertOpen} />}
    </div>
  );
}
