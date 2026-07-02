import { useRoute } from "wouter";
import { useGetProject, useGetProjectRecommendations, useListProjectMatches, useCreateMatch, getListProjectMatchesQueryKey, getGetProjectQueryKey, getGetProjectRecommendationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Building2, Calendar, DollarSign, Tag, CheckCircle2, ChevronRight, Zap, Bot, Network, Sparkles, ShieldCheck } from "lucide-react";
import { getCompanyTypeMeta } from "@/lib/companyType";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: project, isLoading: isProjectLoading } = useGetProject(id, { query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) } });
  const { data: recommendations, isLoading: isRecsLoading } = useGetProjectRecommendations(id, { query: { enabled: !!id, queryKey: getGetProjectRecommendationsQueryKey(id) } });
  const { data: matches, isLoading: isMatchesLoading } = useListProjectMatches(id, { query: { enabled: !!id, queryKey: getListProjectMatchesQueryKey(id) } });
  const createMatch = useCreateMatch();

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
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="recommendations">AI 추천 파트너</TabsTrigger>
          <TabsTrigger value="matches">현재 매칭 현황 {matches && matches.length > 0 && `(${matches.length})`}</TabsTrigger>
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
                            disabled={invited || createMatch.isPending}
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

        <TabsContent value="matches" className="pt-6">
          <Card>
            <CardHeader>
              <CardTitle>매칭 진행 현황</CardTitle>
              <CardDescription>이 프로젝트에 대해 진행 중인 매칭 목록입니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {isMatchesLoading ? (
                <div className="space-y-4"><Skeleton className="h-16 w-full" /></div>
              ) : matches?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">아직 진행 중인 매칭이 없습니다. AI 추천 탭에서 파트너를 초대해보세요.</div>
              ) : (
                <div className="space-y-4">
                  {matches?.map(match => (
                    <div key={match.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center font-mono font-bold text-primary">
                          {match.synergyScore}
                        </div>
                        <div>
                          <div className="font-medium text-base">{match.company?.name || `기업 #${match.companyId}`}</div>
                          <div className="text-sm text-muted-foreground">{new Date(match.createdAt).toLocaleDateString()} 제안됨</div>
                        </div>
                      </div>
                      <div>
                        {match.status === 'pending' && <Badge variant="outline" className="bg-amber-500/10 text-amber-600">대기중</Badge>}
                        {match.status === 'accepted' && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">수락됨</Badge>}
                        {match.status === 'declined' && <Badge variant="outline" className="bg-destructive/10 text-destructive">거절됨</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
