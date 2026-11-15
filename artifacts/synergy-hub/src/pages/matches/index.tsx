import { useIsAdmin } from "@/lib/auth";
import { useState } from "react";
import { Link } from "wouter";
import { useListMatches, useUpdateMatch, getListMatchesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, Check, X, ArrowRight, Building2, Calendar, LayoutDashboard } from "lucide-react";

export default function MatchesList() {
  const [status, setStatus] = useState<"pending" | "accepted" | "declined" | "all">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: matches, isLoading } = useListMatches({
    status: status !== "all" ? status : undefined,
  });

  const updateMatch = useUpdateMatch();
  const isAdmin = useIsAdmin();

  const handleStatusChange = (id: number, newStatus: "accepted" | "declined") => {
    updateMatch.mutate({
      id,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        toast({ title: "상태 변경", description: `매칭이 ${newStatus === 'accepted' ? '수락' : '거절'}되었습니다.` });
        queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
      },
      onError: () => {
        toast({ title: "오류", description: "상태 변경 중 문제가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">코셀링 매칭 보드</h1>
          <p className="text-muted-foreground mt-1">제안된 파트너십을 검토하고 합동 수주(Co-selling)를 결정하세요.</p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 border rounded-lg shadow-sm w-full sm:w-auto sm:inline-flex">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">상태 필터:</span>
        <Select value={status} onValueChange={(val: any) => setStatus(val)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="모든 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 내역</SelectItem>
            <SelectItem value="pending">대기중인 제안</SelectItem>
            <SelectItem value="accepted">수락된 매칭</SelectItem>
            <SelectItem value="declined">거절된 매칭</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : matches?.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
          <Network className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">진행 중인 매칭이 없습니다</h3>
          <p className="text-muted-foreground mt-1">프로젝트 상세 페이지에서 추천 파트너에게 매칭을 제안해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {matches?.map(match => (
            <Card key={match.id} className={`overflow-hidden border-l-4 ${
              match.status === 'pending' ? 'border-l-amber-500' :
              match.status === 'accepted' ? 'border-l-emerald-500' : 'border-l-destructive'
            }`}>
              <div className="flex flex-col lg:flex-row">
                {/* Synergy Score */}
                <div className="bg-muted/30 p-6 lg:w-48 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-border/50">
                  <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-widest">시너지 점수</div>
                  <div className="text-4xl font-bold font-mono text-primary flex items-end">
                    {match.synergyScore}<span className="text-base text-primary/50 ml-1 mb-1">%</span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Project Info */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center"><LayoutDashboard className="w-3 h-3 mr-1" /> 대상 프로젝트</div>
                    <Link href={`/projects/${match.projectId}`} className="text-lg font-bold hover:text-primary transition-colors line-clamp-1">
                      {match.project?.title || `프로젝트 #${match.projectId}`}
                    </Link>
                    <div className="text-sm text-muted-foreground flex items-center">
                      <Building2 className="w-3.5 h-3.5 mr-1" /> {match.project?.demandCompany}
                    </div>
                  </div>

                  {/* Company Info */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground flex items-center"><Network className="w-3 h-3 mr-1" /> 제안 대상 파트너</div>
                    <Link href={`/companies/${match.companyId}`} className="text-lg font-bold hover:text-primary transition-colors line-clamp-1">
                      {match.company?.name || `기업 #${match.companyId}`}
                    </Link>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-1.5">
                      {match.company?.capabilityTags.slice(0, 3).map(tag => (
                        <span key={tag} className="bg-secondary/50 px-1.5 py-0.5 rounded-sm text-[11px]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-muted/10 lg:w-64 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-border/50 gap-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs text-muted-foreground flex items-center"><Calendar className="w-3 h-3 mr-1"/> {new Date(match.createdAt).toLocaleDateString()}</div>
                    {match.status === 'pending' && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">대기중</Badge>}
                    {match.status === 'accepted' && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">수락됨</Badge>}
                    {match.status === 'declined' && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">거절됨</Badge>}
                  </div>

                  {isAdmin && match.status === 'pending' && (
                    <div className="flex gap-2 w-full mt-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => handleStatusChange(match.id, "declined")}
                        disabled={updateMatch.isPending}
                      >
                        <X className="w-4 h-4 mr-1" /> 거절
                      </Button>
                      <Button 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleStatusChange(match.id, "accepted")}
                        disabled={updateMatch.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" /> 수락
                      </Button>
                    </div>
                  )}

                  {match.status === 'accepted' && (
                    <Button variant="secondary" className="w-full font-medium" asChild>
                      <Link href="/solutions/new">조인트 솔루션 만들기 <ArrowRight className="w-4 h-4 ml-2" /></Link>
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
