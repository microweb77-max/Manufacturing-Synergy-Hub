import { useRoute } from "wouter";
import { useGetSolution, getGetSolutionQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Star, Factory, Monitor, ChevronRight, CheckCircle2, Server } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function SolutionDetail() {
  const [, params] = useRoute("/solutions/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  
  const { data: solution, isLoading } = useGetSolution(id, { query: { enabled: !!id, queryKey: getGetSolutionQueryKey(id) } });

  if (isLoading) {
    return <div className="p-8 max-w-5xl mx-auto"><Skeleton className="h-96 w-full" /></div>;
  }

  if (!solution) {
    return <div className="p-8 max-w-5xl mx-auto">솔루션을 찾을 수 없습니다.</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-secondary/10 border border-border/50">
        <div className="absolute inset-0 z-0">
          {solution.imageUrl ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/20 z-10"></div>
              <img src={solution.imageUrl} alt={solution.title} className="w-full h-full object-cover" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-end pr-32 bg-gradient-to-r from-background to-secondary/30">
               <Server className="w-64 h-64 text-secondary/20" />
            </div>
          )}
        </div>
        
        <div className="relative z-20 p-8 lg:p-12 w-full lg:w-2/3">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm border-primary text-primary px-3 py-1">
              {solution.category}
            </Badge>
            {solution.featured && (
              <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 px-3 py-1">
                <Star className="w-3 h-3 mr-1 fill-current" /> 우수 도입 사례
              </Badge>
            )}
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">
            {solution.title}
          </h1>
          
          <div className="flex flex-wrap gap-2 mt-6">
            {solution.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="bg-background/80 backdrop-blur-sm border-border/50 text-sm font-normal px-3 py-1">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center"><Layers className="w-5 h-5 mr-2 text-primary"/> 솔루션 개요</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {solution.description}
              </p>
            </CardContent>
          </Card>

          {solution.outcome && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-xl flex items-center text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 mr-2" /> 도입 성과 및 기대 효과
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed whitespace-pre-wrap text-emerald-800 dark:text-emerald-300 font-medium">
                  {solution.outcome}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-lg font-bold border-b pb-2">참여 파트너 컨소시엄</h3>
          <div className="space-y-4">
            {solution.companies?.map(company => (
              <Link key={company.id} href={`/companies/${company.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                      {company.type === "hardware" ? <Factory className="w-6 h-6 text-amber-600" /> : <Monitor className="w-6 h-6 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base truncate group-hover:text-primary transition-colors">{company.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        {company.type === "hardware" ? <span className="text-amber-600">하드웨어 담당</span> : <span className="text-blue-600">소프트웨어 담당</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
