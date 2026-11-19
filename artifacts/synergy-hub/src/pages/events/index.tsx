import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEvents,
  getListEventsQueryKey,
  useListMyBookmarks,
  getListMyBookmarksQueryKey,
  useAddMyBookmark,
  useRemoveMyBookmark,
  useGetMyAlertPreferences,
  getGetMyAlertPreferencesQueryKey,
  usePutMyAlertPreferences,
  type EventItem,
  type ListEventsPeriod,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarDays, Bell, Star, MapPin, Building2, ExternalLink, Filter, Globe } from "lucide-react";

const ALL = "__all__";
export const EVENT_CATEGORIES = ["제조", "자동화", "AI", "전자·반도체", "물류", "기타"];
const EVENT_CITIES = ["하노이", "호치민", "다낭", "기타·온라인"];
const PERIODS: { value: ListEventsPeriod; label: string }[] = [
  { value: "month", label: "이번 달" },
  { value: "three-months", label: "3개월" },
  { value: "all", label: "전체" },
];

const CATEGORY_STYLES: Record<string, string> = {
  제조: "bg-blue-100 text-blue-800",
  자동화: "bg-violet-100 text-violet-800",
  AI: "bg-emerald-100 text-emerald-800",
  "전자·반도체": "bg-cyan-100 text-cyan-800",
  물류: "bg-amber-100 text-amber-800",
  기타: "bg-slate-100 text-slate-700",
};

function todayVietnam(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function dayDiff(date: string, today: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

function dDay(e: EventItem, today: string): { text: string; past: boolean } {
  const start = dayDiff(e.startDate, today);
  const end = dayDiff(e.endDate ?? e.startDate, today);
  if (end < 0) return { text: "종료", past: true };
  if (start <= 0) return { text: "진행 중", past: false };
  return { text: `D-${start}`, past: false };
}

function formatRange(e: EventItem): string {
  const f = (d: string) => `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
  return e.endDate && e.endDate !== e.startDate ? `${f(e.startDate)} ~ ${f(e.endDate)}` : f(e.startDate);
}

function AlertSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = { itemType: "event" as const };
  const { data } = useGetMyAlertPreferences(params, {
    query: { queryKey: getGetMyAlertPreferencesQueryKey(params), enabled: open },
  });
  const save = usePutMyAlertPreferences();
  // Local edits override the saved values until the dialog closes.
  const [draft, setDraft] = useState<{ categories: string[]; weeklyEmail: boolean; email: string } | null>(null);
  const categories = draft?.categories ?? data?.categories ?? [];
  const weeklyEmail = draft?.weeklyEmail ?? data?.weeklyEmail ?? false;
  const email = draft?.email ?? data?.email ?? "";
  const edit = (patch: Partial<{ categories: string[]; weeklyEmail: boolean; email: string }>) =>
    setDraft({ categories, weeklyEmail, email, ...patch });

  const submit = () => {
    save.mutate(
      { data: { itemType: "event", categories, weeklyEmail, ...(email.trim() ? { email: email.trim() } : {}) } },
      {
        onSuccess: () => {
          toast({ title: "알림 설정 저장", description: weeklyEmail ? "매주 새 행사 요약 메일을 보내드립니다." : "주간 메일이 꺼져 있습니다." });
          qc.invalidateQueries({ queryKey: getGetMyAlertPreferencesQueryKey(params) });
          setDraft(null);
          onOpenChange(false);
        },
        onError: () => toast({ title: "오류", description: "저장하지 못했습니다. 이메일 형식을 확인해 주세요.", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setDraft(null); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />행사 알림 설정</DialogTitle>
          <DialogDescription>관심 분야를 고르면 새로 등록된 행사를 주 1회 메일로 요약해 드립니다. 메일의 링크로 언제든 해지할 수 있습니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {EVENT_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={categories.includes(c)}
                  onCheckedChange={(v) => edit({ categories: v ? [...categories, c] : categories.filter((x) => x !== c) })}
                />
                {c}
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="weekly-email">주간 메일 받기</Label>
            <Switch id="weekly-email" checked={weeklyEmail} onCheckedChange={(v) => edit({ weeklyEmail: v })} />
          </div>
          {weeklyEmail && (
            <div className="space-y-1">
              <Label htmlFor="alert-email">받을 이메일 <span className="text-muted-foreground font-normal">(비우면 계정 이메일)</span></Label>
              <Input id="alert-email" type="email" value={email} onChange={(e) => edit({ email: e.target.value })} placeholder="name@company.com" />
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={save.isPending || (weeklyEmail && categories.length === 0)}>저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventDetailDialog({ event, onClose }: { event: EventItem | null; onClose: () => void }) {
  return (
    <Dialog open={!!event} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[560px]">
        {event && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`${CATEGORY_STYLES[event.category] ?? CATEGORY_STYLES["기타"]} border-0`}>{event.category}</Badge>
                {event.isOnline && <Badge variant="outline"><Globe className="h-3 w-3 mr-1" />온라인</Badge>}
              </div>
              <DialogTitle className="text-xl leading-snug">{event.title}</DialogTitle>
              {event.originalTitle && <DialogDescription className="italic">{event.originalTitle}</DialogDescription>}
            </DialogHeader>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2"><dt className="w-14 shrink-0 text-muted-foreground">일정</dt><dd>{formatRange(event)}</dd></div>
              <div className="flex gap-2"><dt className="w-14 shrink-0 text-muted-foreground">장소</dt><dd>{[event.city, event.venue].filter(Boolean).join(" · ")}</dd></div>
              {event.organizer && <div className="flex gap-2"><dt className="w-14 shrink-0 text-muted-foreground">주최</dt><dd>{event.organizer}</dd></div>}
            </dl>
            {event.summary && <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{event.summary}</p>}
            {event.sourceUrl && (
              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                원문 보기 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function EventsPage() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [category, setCategory] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [period, setPeriod] = useState<ListEventsPeriod>("all");
  const [includePast, setIncludePast] = useState(false);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  const params = {
    ...(category !== ALL ? { category } : {}),
    ...(city !== ALL ? { city } : {}),
    period,
    ...(includePast ? { includePast: true } : {}),
  };
  const { data: events, isLoading } = useListEvents(params, { query: { queryKey: getListEventsQueryKey(params) } });

  const bmParams = { itemType: "event" as const };
  const bmKey = getListMyBookmarksQueryKey(bmParams);
  const { data: bookmarks } = useListMyBookmarks(bmParams, { query: { queryKey: bmKey, enabled: isSignedIn === true } });
  const bookmarked = useMemo(() => new Set((bookmarks ?? []).map((b) => b.itemId)), [bookmarks]);
  const add = useAddMyBookmark();
  const remove = useRemoveMyBookmark();

  const toggleBookmark = (e: EventItem) => {
    if (!isSignedIn) return;
    const done = () => qc.invalidateQueries({ queryKey: bmKey });
    const fail = () => toast({ title: "오류", description: "관심 등록을 변경하지 못했습니다.", variant: "destructive" });
    if (bookmarked.has(e.id)) remove.mutate({ params: { itemType: "event", itemId: e.id } }, { onSuccess: done, onError: fail });
    else add.mutate({ data: { itemType: "event", itemId: e.id } }, { onSuccess: done, onError: fail });
  };

  const today = todayVietnam();
  const shown = tab === "mine" ? (events ?? []).filter((e) => bookmarked.has(e.id)) : events ?? [];
  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><CalendarDays className="h-7 w-7 text-primary" />행사·세미나</h1>
          <p className="mt-2 text-muted-foreground">베트남 제조·자동화·AI 관련 전시회, 컨퍼런스, 세미나, 상담회를 한곳에서 확인하세요.</p>
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
          <button className={chip(category === ALL)} onClick={() => setCategory(ALL)}>전체 분야</button>
          {EVENT_CATEGORIES.map((c) => <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>{c}</button>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <button className={chip(city === ALL)} onClick={() => setCity(ALL)}>전체 지역</button>
          {EVENT_CITIES.map((c) => <button key={c} className={chip(city === c)} onClick={() => setCity(c)}>{c}</button>)}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {PERIODS.map((p) => <button key={p.value} className={chip(period === p.value)} onClick={() => setPeriod(p.value)}>{p.label}</button>)}
          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={includePast} onCheckedChange={setIncludePast} />지난 행사 보기
          </label>
        </div>
      </div>

      {tab === "mine" && !isSignedIn ? (
        <Card className="mt-6"><CardContent className="py-12 text-center space-y-3">
          <p className="text-muted-foreground">로그인하면 관심 행사를 모아 볼 수 있습니다.</p>
          <Link href="/sign-in"><Button>로그인</Button></Link>
        </CardContent></Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
          ) : shown.length === 0 ? (
            <Card className="md:col-span-2"><CardContent className="py-16 text-center">
              <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">{tab === "mine" ? "관심 등록한 행사가 없습니다." : "조건에 맞는 행사가 없습니다."}</p>
            </CardContent></Card>
          ) : (
            shown.map((e) => {
              const dd = dDay(e, today);
              return (
                <Card key={e.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(e)} data-testid={`event-card-${e.id}`}>
                  <CardContent className="p-4 flex gap-3">
                    <div className="shrink-0 w-14 rounded-md bg-primary/10 text-primary text-center py-2">
                      <div className="text-xs">{e.startDate.slice(0, 4)}</div>
                      <div className="text-xl font-bold leading-none">{e.startDate.slice(5, 7)}.{e.startDate.slice(8, 10)}</div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`${CATEGORY_STYLES[e.category] ?? CATEGORY_STYLES["기타"]} border-0`}>{e.category}</Badge>
                        <Badge variant={dd.past ? "outline" : "default"}>{dd.text}</Badge>
                        {e.isOnline && <Badge variant="outline">온라인</Badge>}
                      </div>
                      <h3 className="font-semibold leading-snug">{e.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{[e.city, e.venue].filter(Boolean).join(" · ")}</p>
                      {e.organizer && <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{e.organizer}</p>}
                    </div>
                    {isSignedIn ? (
                      <button
                        aria-label={bookmarked.has(e.id) ? "관심 해제" : "관심 등록"}
                        className="self-start p-1"
                        onClick={(ev) => { ev.stopPropagation(); toggleBookmark(e); }}
                      >
                        <Star className={`h-5 w-5 ${bookmarked.has(e.id) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
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

      <EventDetailDialog event={selected} onClose={() => setSelected(null)} />
      {isSignedIn && <AlertSettingsDialog open={alertOpen} onOpenChange={setAlertOpen} />}
    </div>
  );
}
