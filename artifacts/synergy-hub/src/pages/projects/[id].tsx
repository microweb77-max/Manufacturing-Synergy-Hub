import { useRoute } from "wouter";
import { useGetProject, useGetProjectRecommendations, useListProjectMatches, useCreateMatch, useListProjectApplications, useCreateProjectApplication, useListCompanies, useListMyCompanies, getListMyCompaniesQueryKey, getListProjectMatchesQueryKey, getListProjectApplicationsQueryKey, getGetProjectQueryKey, getGetProjectRecommendationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Calendar, DollarSign, Tag, CheckCircle2, ChevronRight, Zap, Bot, Network, Sparkles, ShieldCheck, Send, UserPlus } from "lucide-react";
import { getCompanyTypeMeta } from "@/lib/companyType";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminAuth } from "@/lib/adminAuth";

export default function ProjectDetail() {
  const { isAdmin } = useAdminAuth();
  const [, params] = useRoute("/projects/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: project, isLoading: isProjectLoading } = useGetProject(id, { query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) } });
  const { data: recommendations, isLoading: isRecsLoading } = useGetProjectRecommendations(id, { query: { enabled: !!id, queryKey: getGetProjectRecommendationsQueryKey(id) } });
  const { data: matches, isLoading: isMatchesLoading } = useListProjectMatches(id, { query: { enabled: !!id, queryKey: getListProjectMatchesQueryKey(id) } });
  const { data: applications, isLoading: isApplicationsLoading } = useListProjectApplications({ projectId: id }, { query: { enabled: !!id && isAdmin, queryKey: getListProjectApplicationsQueryKey({ projectId: id }) } });
  const { isSignedIn, userId } = useAuth();
  const { data: allCompanies } = useListCompanies({});
  const { data: myCompanies } = useListMyCompanies({ query: { enabled: !!isSignedIn && !isAdmin, queryKey: [...getListMyCompaniesQueryKey(), userId ?? null], staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000 } });
  const companies = isAdmin ? allCompanies : allCompanies?.filter((c) => myCompanies?.some((mc) => mc.companyId === c.id));
  const canApply = isAdmin || (myCompanies?.length ?? 0) > 0;
  const createMatch = useCreateMatch();
  const createApplication = useCreateProjectApplication();

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyCompanyId, setApplyCompanyId] = useState("");
  const [applyContactName, setApplyContactName] = useState("");
  const [applyContactInfo, setApplyContactInfo] = useState("");
  const [applyMessage, setApplyMessage] = useState("");

  const resetApplyForm = () => {
    setApplyCompanyId("");
    setApplyContactName("");
    setApplyContactInfo("");
    setApplyMessage("");
  };

  const handleApply = () => {
    if (!applyCompanyId) {
      toast({ title: "지원사를 선택해주세요", description: "기업 디렉토리에서 지원할 기업을 선택해야 합니다.", variant: "destructive" });
      return;
    }
    createApplication.mutate({
      data: {
        projectId: id,
        companyId: parseInt(applyCompanyId, 10),
        message: applyMessage,
        contactName: applyContactName,
        contactInfo: applyContactInfo,
      },
    }, {
      onSuccess: () => {
        toast({ title: "지원 완료", description: "프로젝트 지원이 접수되었습니다. 관리자 검토 후 연락드립니다." });
        queryClient.invalidateQueries({ queryKey: getListProjectApplicationsQueryKey({ projectId: id }) });
        resetApplyForm();
        setApplyOpen(false);
      },
      onError: () => {
        toast({ title: "오류", description: "지원 접수 중 문제가 발생했습니다.", variant: "destructive" });
      },
    });
  };

  const handleInvite = (companyId: number, synergyScore: number) => {
    createMatch.mutate({
      data: { projectId: id, companyId, synergyScore }
    }, {
      onSuccess: () => {
        toast({ title: "초대 발송 완료", description: "해당 기업에 프로젝트 매칭 요청을 보냈습니다." });
        queryClient.invalidateQueries({ queryKey: getListProjectMatchesQueryKey(id) });
      },
      onError: () => {
        toast({ title: "오류", description: "초대 발송 중 문제가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  if (isProjectLoading) {
    return <div className="p-8 max-w-6xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!project) return <div className="p-8">프로젝트를 찾을 수 없습니다.</div>;

  const isInvited = (companyId: number) => {
    return matches?.some(m => m.companyId === companyId);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'open': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200 text-sm py-1">수요 등록됨</Badge>;
      case 'matching': return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200 text-sm py-1">매칭 진행중</Badge>;
      case 'in_progress': return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200 text-sm py-1">프로젝트 진행중</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-sm py-1">완료</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getApplicationStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-600">접수됨</Badge>;
      case 'reviewing': return <Badge variant="outline" className="bg-blue-500/10 text-blue-600">검토중</Badge>;
      case 'accepted': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">수락됨</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-destructive/10 text-destructive">거절됨</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMatchStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <Badge variant="outline" className="bg-amber-500/10 text-amber-600">대기중</Badge>;
      case 'accepted': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">수락됨</Badge>;
      case 'declined': return <Badge variant="outline" className="bg-destructive/10 text-destructive">거절됨</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  type FeedItem =
    | { kind: "invite"; id: number; createdAt: string; sortKey: number; match: NonNullable<typeof matches>[number] }
    | { kind: "apply"; id: number; createdAt: string; sortKey: number; app: NonNullable<typeof applications>[number] };

  const feedItems: FeedItem[] = [
    ...(matches ?? []).map((m): FeedItem => ({ kind: "invite", id: m.id, createdAt: m.createdAt, sortKey: new Date(m.createdAt).getTime(), match: m })),
    ...(applications ?? []).map((a): FeedItem => ({ kind: "apply", id: a.id, createdAt: a.createdAt, sortKey: new Date(a.createdAt).getTime(), app: a })),
  ].sort((a, b) => b.sortKey - a.sortKey);

  const participantCount = (matches?.length ?? 0) + (applications?.length ?? 0);
  const isFeedLoading = isMatchesLoading || isApplicationsLoading;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Project Header */}
      <div className="bg-card border rounded-lg p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
              {getStatusBadge(project.status)}
            </div>
            
            <p className="text-lg text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t">
              <div className="space-y-1">
                <span className="flex items-center text-sm text-muted-foreground"><Building2 className="w-4 h-4 mr-2"/> 수요 기업</span>
                <span className="font-medium text-base">{project.demandCompany}</span>
              </div>
              <div className="space-y-1">
                <span className="flex items-center text-sm text-muted-foreground"><Tag className="w-4 h-4 mr-2"/> 카테고리</span>
                <span className="font-medium text-base">{project.category}</span>
              </div>
              <div className="space-y-1">
                <span className="flex items-center text-sm text-muted-foreground"><DollarSign className="w-4 h-4 mr-2"/> 예산</span>
                <span className="font-mono font-medium text-base">{project.budget || '미정'}</span>
              </div>
              <div className="space-y-1">
                <span className="flex items-center text-sm text-muted-foreground"><Calendar className="w-4 h-4 mr-2"/> 마감일</span>
                <span className="font-medium text-base">{project.deadline ? new Date(project.deadline).toLocaleDateString() : '미정'}</span>
              </div>
            </div>
          </div>
          
          <div className="w-full lg:w-72 bg-secondary/10 rounded-lg p-5 border border-secondary/20 shrink-0">
            <h3 className="font-medium text-sm text-secondary-foreground mb-3 flex items-center"><Zap className="w-4 h-4 mr-2 text-primary" /> 요구 역량 태그</h3>
            <div className="flex flex-wrap gap-2">
              {project.requiredTags.map(tag => (
                <Badge key={tag} variant="default" className="bg-primary hover:bg-primary/90">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="recommendations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[440px]">
          <TabsTrigger value="recommendations">AI 추천 파트너</TabsTrigger>
          <TabsTrigger value="participants">매칭 · 지원 현황 {participantCount > 0 && `(${participantCount})`}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="recommendations" className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-primary" />
              시너지 AI 분석 결과
            </h2>
            <p className="text-sm text-muted-foreground">요구 역량과 기업 데이터를 분석하여 최적의 파트너를 제안합니다.</p>
          </div>

          {isRecsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : recommendations?.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">조건에 맞는 추천 기업이 없습니다.</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {recommendations?.map((rec, idx) => {
                const invited = isInvited(rec.company.id);
                return (
                  <Card key={idx} className="overflow-hidden border-primary/20 hover:border-primary/50 transition-colors">
                    <div className="flex flex-col md:flex-row">
                      <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 md:w-48 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border">
                        <div className="text-sm font-medium text-muted-foreground mb-1 tracking-widest uppercase">시너지 점수</div>
                        <div className="text-5xl font-bold font-mono text-primary flex items-end">
                          {rec.synergyScore}<span className="text-xl text-primary/50 ml-1 mb-1">%</span>
                        </div>
                      </div>
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="text-xl font-bold">{rec.company.name}</h3>
                            {(() => {
                              const meta = getCompanyTypeMeta(rec.company.type);
                              const TypeIcon = meta.icon;
                              return (
                                <Badge variant="secondary" className={meta.badgeClass}>
                                  <TypeIcon className="w-3 h-3 mr-1" /> {meta.label}
                                </Badge>
                              );
                            })()}
                          </div>
                          
                          <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground mb-4 border border-border/50">
                            <Sparkles className="w-4 h-4 text-amber-500 inline mr-2 -mt-0.5" />
                            {rec.reason}
                          </div>
                          
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-muted-foreground">매칭된 역량:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {rec.matchedTags.map(tag => (
                                <Badge key={tag} variant="outline" className="border-primary/30 text-primary">{tag}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/50">
                          <div className="flex gap-4">
                            <span className="flex items-center text-xs text-muted-foreground"><ShieldCheck className="w-3 h-3 text-emerald-500 mr-1"/> 신뢰: {rec.company.trustScore}</span>
                            <span className="flex items-center text-xs text-muted-foreground"><Network className="w-3 h-3 text-purple-500 mr-1"/> 협업: {rec.company.collaborationCount}</span>
                          </div>
                          <Button 
                            variant={invited ? "secondary" : "default"} 
                            disabled={!isAdmin || invited || createMatch.isPending}
                            onClick={() => handleInvite(rec.company.id, rec.synergyScore)}
                          >
                            {invited ? "초대 완료됨" : "매칭 제안하기"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="participants" className="pt-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>매칭 · 지원 현황</CardTitle>
                <CardDescription>이 프로젝트에 연결된 파트너 기업입니다. 주최자가 보낸 <span className="font-medium text-foreground">제안 초대</span>와 기업이 직접 낸 <span className="font-medium text-foreground">지원</span>이 함께 표시됩니다.</CardDescription>
              </div>
              <Dialog open={applyOpen} onOpenChange={(o) => { setApplyOpen(o); if (!o) resetApplyForm(); }}>
                <DialogTrigger asChild>
                  <Button disabled={!canApply} title={canApply ? undefined : "인증된 회사 구성원만 지원할 수 있습니다"} className="shrink-0"><UserPlus className="w-4 h-4 mr-2" /> 지원하기</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>프로젝트 지원</DialogTitle>
                    <DialogDescription>「{project.title}」 의뢰에 지원합니다. 기업 디렉토리에서 지원사를 선택하고 제안 내용을 작성해주세요.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>지원사 (기업 디렉토리)</Label>
                      <Select value={applyCompanyId} onValueChange={setApplyCompanyId}>
                        <SelectTrigger><SelectValue placeholder="지원할 기업을 선택하세요" /></SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {companies?.map((c) => {
                            const meta = getCompanyTypeMeta(c.type);
                            return (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name} · {meta.label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>담당자</Label>
                        <Input value={applyContactName} onChange={(e) => setApplyContactName(e.target.value)} placeholder="예: 홍길동 부장" />
                      </div>
                      <div className="space-y-2">
                        <Label>연락처</Label>
                        <Input value={applyContactInfo} onChange={(e) => setApplyContactInfo(e.target.value)} placeholder="이메일 / 전화번호" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>지원(제안) 내용</Label>
                      <Textarea value={applyMessage} onChange={(e) => setApplyMessage(e.target.value)} placeholder="보유 역량, 유사 프로젝트 경험, 협업 제안 등을 작성해주세요." rows={5} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setApplyOpen(false)}>취소</Button>
                    <Button onClick={handleApply} disabled={createApplication.isPending}>
                      <Send className="w-4 h-4 mr-2" /> {createApplication.isPending ? "제출 중..." : "지원 제출"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isFeedLoading ? (
                <div className="space-y-4"><Skeleton className="h-16 w-full" /></div>
              ) : feedItems.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">아직 매칭·지원 내역이 없습니다. AI 추천 탭에서 파트너를 초대하거나, 지원하기 버튼으로 지원을 등록해보세요.</div>
              ) : (
                <div className="space-y-4">
                  {feedItems.map(item => {
                    if (item.kind === "invite") {
                      const match = item.match;
                      return (
                        <div key={`m-${match.id}`} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-mono font-bold text-primary shrink-0">
                                {match.synergyScore}
                              </div>
                              <div>
                                <div className="font-medium text-base flex items-center gap-2 flex-wrap">
                                  {match.company?.name || `기업 #${match.companyId}`}
                                  <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">제안 초대</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">{new Date(match.createdAt).toLocaleDateString()} · 주최자 제안 · 시너지 {match.synergyScore}%</div>
                              </div>
                            </div>
                            {getMatchStatusBadge(match.status)}
                          </div>
                        </div>
                      );
                    }
                    const app = item.app;
                    const meta = getCompanyTypeMeta(app.companyType);
                    const TypeIcon = meta.icon;
                    return (
                      <div key={`a-${app.id}`} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                              <TypeIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium text-base flex items-center gap-2 flex-wrap">
                                {app.companyName || `기업 #${app.companyId}`}
                                <Badge variant="secondary" className={meta.badgeClass}>{meta.label}</Badge>
                                <Badge variant="outline" className="border-emerald-400/50 text-emerald-600 bg-emerald-500/5">지원</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">{new Date(app.createdAt).toLocaleDateString()} · 기업 지원</div>
                            </div>
                          </div>
                          {getApplicationStatusBadge(app.status)}
                        </div>
                        {app.message && (
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 border border-border/50 rounded-md p-3">{app.message}</p>
                        )}
                        {(app.contactName || app.contactInfo) && (
                          <div className="text-xs text-muted-foreground">
                            담당자: {app.contactName || "-"} · 연락처: {app.contactInfo || "-"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
