import { useState } from "react";
import { Link } from "wouter";
import { useListProjects } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Plus, Calendar, DollarSign, Building2, Tag, ChevronRight } from "lucide-react";

export default function ProjectsList() {
  const [status, setStatus] = useState<"open" | "matching" | "in_progress" | "completed" | "all">("all");

  const { data: projects, isLoading } = useListProjects({
    status: status !== "all" ? status : undefined,
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'open': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'matching': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'in_progress': return 'bg-purple-500/10 text-purple-600 border-purple-200';
      case 'completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      default: return 'bg-secondary/20 text-secondary-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'open': return '수요 등록됨';
      case 'matching': return '매칭 진행중';
      case 'in_progress': return '프로젝트 진행중';
      case 'completed': return '완료';
      default: return status;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">수요 프로젝트</h1>
          <p className="text-muted-foreground mt-1">현장의 수요를 기반으로 생성된 프로젝트를 탐색하고 매칭에 참여하세요.</p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            새 프로젝트 생성
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 border rounded-lg shadow-sm w-full sm:w-auto sm:inline-flex">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">상태 필터:</span>
        <Select value={status} onValueChange={(val: any) => setStatus(val)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="모든 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 상태</SelectItem>
            <SelectItem value="open">수요 등록됨</SelectItem>
            <SelectItem value="matching">매칭 진행중</SelectItem>
            <SelectItem value="in_progress">프로젝트 진행중</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
          <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">프로젝트가 없습니다</h3>
          <p className="text-muted-foreground mt-1">해당 상태의 프로젝트가 존재하지 않습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects?.map(project => (
            <Card key={project.id} className="hover:shadow-md transition-all group">
              <div className="p-6 flex flex-col lg:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex items-start justify-between lg:justify-start gap-4">
                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{project.title}</h3>
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {getStatusText(project.status)}
                    </Badge>
                  </div>
                  
                  <p className="text-muted-foreground line-clamp-2 text-sm">{project.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center"><Building2 className="w-4 h-4 mr-1.5" /> 수요기업: <span className="font-medium ml-1 text-foreground">{project.demandCompany}</span></div>
                    {project.budget && <div className="flex items-center"><DollarSign className="w-4 h-4 mr-1.5" /> 예산: <span className="font-medium ml-1 font-mono text-foreground">{project.budget}</span></div>}
                    {project.deadline && <div className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> 마감일: <span className="font-medium ml-1 text-foreground">{new Date(project.deadline).toLocaleDateString()}</span></div>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {project.requiredTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="bg-secondary/40 font-normal">{tag}</Badge>
                    ))}
                  </div>
                </div>
                
                <div className="lg:w-48 flex items-center justify-end border-t lg:border-t-0 lg:border-l border-border/50 pt-4 lg:pt-0 lg:pl-6">
                  <Link href={`/projects/${project.id}`}>
                    <Button variant="outline" className="w-full lg:w-auto">
                      상세 보기 <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
