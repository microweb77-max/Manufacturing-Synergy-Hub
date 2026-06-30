import { useState } from "react";
import { useRoute } from "wouter";
import { useGetCompany, useListPerformanceLogs, getGetCompanyQueryKey, getListPerformanceLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Mail, Calendar, Star, ShieldCheck, Factory, Monitor, Briefcase, Activity, Target, Hash, Phone, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { normalizeImageUrl } from "@/lib/imageUrl";

export default function CompanyDetail() {
  const [, params] = useRoute("/companies/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [logoFailed, setLogoFailed] = useState(false);

  const { data: company, isLoading } = useGetCompany(id, { query: { enabled: !!id, queryKey: getGetCompanyQueryKey(id) } });
  const { data: performanceLogs, isLoading: isLogsLoading } = useListPerformanceLogs({ companyId: id }, { query: { enabled: !!id, queryKey: getListPerformanceLogsQueryKey({ companyId: id }) } });

  if (isLoading) {
    return <div className="p-8 max-w-5xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!company) {
    return <div className="p-8 max-w-5xl mx-auto">기업 정보를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-24 h-24 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0 shadow-sm">
          {company.logoUrl && !logoFailed ? (
            <img
              src={normalizeImageUrl(company.logoUrl)}
              alt={company.name}
              className="w-full h-full object-cover rounded-lg"
              onError={() => setLogoFailed(true)}
            />
          ) : company.type === "hardware" ? (
            <Factory className="w-10 h-10 text-secondary" />
          ) : (
            <Monitor className="w-10 h-10 text-secondary" />
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
              {company.type === "hardware" ? (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600"><Factory className="w-3 h-3 mr-1"/> 하드웨어</Badge>
              ) : (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600"><Monitor className="w-3 h-3 mr-1"/> 소프트웨어</Badge>
              )}
            </div>
            <p className="text-lg text-muted-foreground">{company.description}</p>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {company.location && <div className="flex items-center"><MapPin className="w-4 h-4 mr-2" /> {company.location}</div>}
            {company.contactEmail && <div className="flex items-center"><Mail className="w-4 h-4 mr-2" /> {company.contactEmail}</div>}
            {company.phone && <div className="flex items-center"><Phone className="w-4 h-4 mr-2" /> {company.phone}</div>}
            {company.kakaoTalkId && <div className="flex items-center"><MessageCircle className="w-4 h-4 mr-2" /> 카카오톡: {company.kakaoTalkId}</div>}
            {company.taxCode && <div className="flex items-center"><Hash className="w-4 h-4 mr-2" /> MST: {company.taxCode}</div>}
            <div className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> 등록일: {new Date(company.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">신뢰 점수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold font-mono">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              {company.trustScore} <span className="text-sm font-sans text-muted-foreground">/ 100</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">평점</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold font-mono">
              <Star className="w-5 h-5 text-amber-500 fill-current" />
              {company.rating.toFixed(1)} <span className="text-sm font-sans text-muted-foreground">/ 5.0</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">프로젝트 완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold font-mono">
              <Briefcase className="w-5 h-5 text-blue-500" />
              {company.projectsCompleted}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4 pb-2">
            <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider">협업 횟수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold font-mono">
              <Activity className="w-5 h-5 text-purple-500" />
              {company.collaborationCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="capabilities" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="capabilities">역량 및 스펙</TabsTrigger>
          <TabsTrigger value="performance">참여 프로젝트</TabsTrigger>
        </TabsList>
        <TabsContent value="capabilities" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center"><Target className="w-5 h-5 mr-2 text-primary" /> 주요 역량 태그</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {company.capabilityTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="px-3 py-1.5 text-sm">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">기술 스펙 (Tech Specs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap font-mono text-sm bg-muted/50 p-6 rounded-md border border-border/50">
                {company.techSpecs}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="performance" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">프로젝트 기여 내역</CardTitle>
            </CardHeader>
            <CardContent>
              {isLogsLoading ? (
                <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ) : performanceLogs?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">아직 참여한 프로젝트가 없습니다.</div>
              ) : (
                <div className="space-y-4">
                  {performanceLogs?.map(log => (
                    <div key={log.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4">
                      <div className="space-y-1">
                        <div className="font-medium text-base">{log.project?.title || `프로젝트 #${log.projectId}`}</div>
                        <div className="text-sm text-muted-foreground">역할: {log.role}</div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">기여도</div>
                          <div className="font-mono font-bold text-lg text-primary">{log.contributionPercent}%</div>
                        </div>
                        {log.revenue && (
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">매출</div>
                            <div className="font-mono font-bold text-lg text-emerald-600">{log.revenue}</div>
                          </div>
                        )}
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
