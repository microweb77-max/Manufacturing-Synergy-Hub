import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetDashboardSummary, useGetRecentActivity, useListCompanies } from "@workspace/api-client-react";
import { Factory, Server, Network, Activity, Layers, Monitor, MapPin, ArrowRight, Megaphone, Handshake, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import heroBanner from "@assets/image_1782676670194.png";

type ShowcaseCompany = {
  id: number;
  name: string;
  type: string;
  location: string;
  description: string;
  capabilityTags: string[];
};

function PartnerCard({ company }: { company: ShowcaseCompany }) {
  const isHardware = company.type === "hardware";
  return (
    <Link href={`/companies/${company.id}`}>
      <div className="flex flex-col gap-3 p-4 border rounded-lg hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer bg-card group h-full">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${isHardware ? "bg-amber-500/10" : "bg-blue-500/10"}`}>
            {isHardware ? <Factory className="w-5 h-5 text-amber-600" /> : <Monitor className="w-5 h-5 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate group-hover:text-primary transition-colors">{company.name}</p>
            {company.location && (
              <span className="flex items-center text-xs text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3 mr-1" /> {company.location}
              </span>
            )}
          </div>
        </div>
        {company.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{company.description}</p>
        )}
        {company.capabilityTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto">
            {company.capabilityTags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="bg-background text-xs font-normal">{tag}</Badge>
            ))}
            {company.capabilityTags.length > 3 && (
              <Badge variant="outline" className="bg-background text-xs font-normal">+{company.capabilityTags.length - 3}</Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: activityItems, isLoading: isActivityLoading } = useGetRecentActivity();
  const { data: companies, isLoading: isCompaniesLoading } = useListCompanies();

  const hardwareCompanies = (companies ?? []).filter((c) => c.type === "hardware").slice(0, 4);
  const softwareCompanies = (companies ?? []).filter((c) => c.type === "software").slice(0, 4);

  return (
    <div className="flex-1 p-8 pt-6 space-y-8 max-w-7xl mx-auto w-full">
      <img
        src={heroBanner}
        alt="베트남 제조산업의 새로운 미래, 당신의 파트너십을 연결합니다"
        className="w-full rounded-lg border-l-[1px] border-t-[1px] border-b-[1px] border-r-[1px]"
      />
      {/* Promotion CTA banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">우리 회사 역량을 회원사에 홍보하세요</p>
              <p className="text-sm text-muted-foreground mt-0.5">기업 프로필을 등록하면 다른 회원사가 우리를 발견하고 공동 영업을 제안할 수 있습니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href="/companies/new">
              <Button className="gap-1.5"><Plus className="w-4 h-4" /> 우리 회사 등록</Button>
            </Link>
            <Link href="/companies">
              <Button variant="outline" className="gap-1.5">회원사 둘러보기 <ArrowRight className="w-4 h-4" /></Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">참여 회원사</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">진행 중인 협업</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.activeProjects ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  완료된 협업 <span className="font-medium text-foreground">{summary?.completedProjects ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">공동 영업 매칭</CardTitle>
            <Handshake className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.acceptedMatches ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  총 매칭 제안 <span className="font-medium text-foreground">{summary?.totalMatches ?? 0}</span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">공동 솔루션</CardTitle>
            <Layers className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <Skeleton className="h-7 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold font-mono">{summary?.jointSolutions ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  함께 만든 패키지
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Co-selling partner showcase */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Handshake className="w-5 h-5 text-primary" /> 함께 협업할 회원사
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">하드웨어와 소프트웨어 파트너를 연결해 공동 솔루션을 제안해보세요.</p>
          </div>
          <Link href="/companies">
            <span className="text-sm text-primary hover:underline cursor-pointer whitespace-nowrap">전체 보기</span>
          </Link>
        </CardHeader>
        <CardContent className="flex-1">
          {isCompaniesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (companies?.length ?? 0) === 0 ? (
            <div className="text-center py-10 text-muted-foreground">아직 등록된 회원사가 없습니다.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                  <Factory className="w-4 h-4" /> 하드웨어 전문 회원사
                </div>
                {hardwareCompanies.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">등록된 하드웨어 회원사가 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hardwareCompanies.map((company) => (
                      <PartnerCard key={company.id} company={company} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
                  <Monitor className="w-4 h-4" /> 소프트웨어 전문 회원사
                </div>
                {softwareCompanies.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">등록된 소프트웨어 회원사가 없습니다.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {softwareCompanies.map((company) => (
                      <PartnerCard key={company.id} company={company} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 flex flex-col">
          <CardHeader>
            <CardTitle>인기 역량 태그</CardTitle>
            <p className="text-sm text-muted-foreground">회원사들이 보유한 핵심 역량입니다. 필요한 역량을 가진 파트너를 찾아보세요.</p>
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
                  <Link key={tag.tag} href="/companies">
                    <div className="flex items-center gap-2 bg-secondary/10 px-3 py-1.5 rounded-md hover:bg-secondary/20 transition-colors cursor-pointer">
                      <span className="text-sm font-medium">{tag.tag}</span>
                      <span className="text-xs font-mono text-muted-foreground bg-background px-1.5 rounded-sm">{tag.count}</span>
                    </div>
                  </Link>
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
    </div>
  );
}
