import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetDashboardSummary, useGetRecentActivity, useGetCompanyLeaderboard } from "@workspace/api-client-react";
import { Factory, Server, Network, ShieldCheck, Activity, Trophy, Monitor } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: activityItems, isLoading: isActivityLoading } = useGetRecentActivity();
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useGetCompanyLeaderboard();

  return (
    <div className="flex-1 p-8 pt-6 space-y-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 기업 수</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.totalCompanies ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  하드웨어 <span className="font-medium text-foreground">{summary?.hardwareCompanies ?? 0}</span> • 소프트웨어 <span className="font-medium text-foreground">{summary?.softwareCompanies ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">진행 중인 프로젝트</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.activeProjects ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  완료된 프로젝트 <span className="font-medium text-foreground">{summary?.completedProjects ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">매칭 성공</CardTitle>
            <Network className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.acceptedMatches ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  총 매칭 시도 <span className="font-medium text-foreground">{summary?.totalMatches ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">평균 신뢰 점수</CardTitle>
            <ShieldCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.avgTrustScore ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  플랫폼 평균
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle>인기 역량 태그</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {isSummaryLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : summary?.topTags?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">데이터가 없습니다.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary?.topTags?.map((tag) => (
                  <div key={tag.tag} className="flex items-center gap-2 bg-secondary/10 px-3 py-1.5 rounded-md">
                    <span className="text-sm font-medium">{tag.tag}</span>
                    <span className="text-xs font-mono text-muted-foreground bg-background px-1.5 rounded-sm">{tag.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {isActivityLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityItems?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">활동 내역이 없습니다.</div>
            ) : (
              <div className="space-y-6">
                {activityItems?.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 text-sm group">
                    <div className="h-9 w-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 border border-secondary/20 group-hover:bg-secondary/20 transition-colors">
                      {activity.type === 'company' && <Factory className="h-4 w-4 text-secondary" />}
                      {activity.type === 'project' && <Activity className="h-4 w-4 text-primary" />}
                      {activity.type === 'match' && <Network className="h-4 w-4 text-emerald-600" />}
                      {activity.type === 'solution' && <Server className="h-4 w-4 text-blue-600" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="font-medium leading-none">{activity.title}</p>
                      <p className="text-muted-foreground text-xs leading-relaxed">{activity.description}</p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> 신뢰도 우수 기업
            </CardTitle>
            <Link href="/companies">
              <span className="text-sm text-primary hover:underline cursor-pointer">전체 보기</span>
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {isLeaderboardLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
              </div>
            ) : leaderboard?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">데이터가 없습니다.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leaderboard?.slice(0, 3).map((company, i) => (
                  <Link key={company.id} href={`/companies/${company.id}`}>
                    <div className="flex items-center gap-4 p-4 border rounded-lg hover:border-primary/50 transition-colors cursor-pointer bg-card relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-muted flex items-center justify-center font-bold text-muted-foreground rounded-bl-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        {i + 1}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        {company.type === "hardware" ? <Factory className="w-6 h-6 text-amber-600" /> : <Monitor className="w-6 h-6 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className="font-bold text-base truncate group-hover:text-primary transition-colors">{company.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center text-xs font-mono text-emerald-600 font-bold">
                            <ShieldCheck className="w-3 h-3 mr-1" /> {company.trustScore}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            프로젝트 {company.projectsCompleted}건
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
