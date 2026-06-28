import { useState } from "react";
import { Link } from "wouter";
import {
  useListSolutions,
  useDeleteSolution,
  getListSolutionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Plus, Star, Factory, Monitor, Layers, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SolutionsList() {
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteSolution = useDeleteSolution();

  const { data: solutions, isLoading } = useListSolutions({
    featured: featuredOnly ? true : undefined,
  });

  const handleDelete = (id: number) => {
    deleteSolution.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "삭제 완료", description: "솔루션 패키지가 삭제되었습니다." });
          queryClient.invalidateQueries({ queryKey: getListSolutionsQueryKey() });
        },
        onError: () => {
          toast({
            title: "오류",
            description: "삭제 중 문제가 발생했습니다.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">조인트 솔루션 갤러리</h1>
          <p className="text-muted-foreground mt-1">하드웨어와 소프트웨어 기업이 만나 탄생한 검증된 합동 솔루션 패키지입니다.</p>
        </div>
        <Link href="/solutions/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            새 솔루션 패키지 등록
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 border rounded-lg shadow-sm w-full sm:w-auto sm:inline-flex">
        <div className="flex items-center space-x-2">
          <Switch 
            id="featured-mode" 
            checked={featuredOnly}
            onCheckedChange={setFeaturedOnly}
          />
          <Label htmlFor="featured-mode" className="flex items-center cursor-pointer">
            <Star className={`w-4 h-4 mr-1 ${featuredOnly ? 'text-amber-500 fill-current' : 'text-muted-foreground'}`} />
            우수 사례만 보기
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="h-[400px]">
              <Skeleton className="h-48 w-full rounded-t-lg rounded-b-none" />
              <CardContent className="mt-4"><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : solutions?.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">솔루션 패키지가 없습니다</h3>
          <p className="text-muted-foreground mt-1">성공적인 매칭을 통해 새로운 합동 솔루션을 만들어보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {solutions?.map(solution => (
            <Link key={solution.id} href={`/solutions/${solution.id}`}>
              <Card className="h-full hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer flex flex-col overflow-hidden group border-border/50 relative">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute top-3 left-3 z-20 h-8 w-8 bg-background/90 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                      aria-label="솔루션 삭제"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle>솔루션 패키지 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        '{solution.title}' 솔루션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(solution.id)}
                      >
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {/* Header Image Area */}
                <div className="h-48 bg-secondary/20 relative flex items-center justify-center border-b border-border/50 overflow-hidden">
                  {solution.imageUrl ? (
                    <img src={solution.imageUrl} alt={solution.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <Server className="w-16 h-16 text-muted-foreground/30" />
                  )}
                  {solution.featured && (
                    <div className="absolute top-4 right-4 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center shadow-amber-500/20">
                      <Star className="w-3 h-3 mr-1 fill-current" /> 우수 사례
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-2.5 py-1 rounded-sm border border-border/50">
                    {solution.category}
                  </div>
                </div>
                
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors">{solution.title}</CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                    {solution.description}
                  </p>
                  
                  <div className="mt-auto space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {solution.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="bg-transparent font-normal">{tag}</Badge>
                      ))}
                      {solution.tags.length > 3 && <Badge variant="outline" className="bg-transparent font-normal">+{solution.tags.length - 3}</Badge>}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="border-t bg-muted/10 py-3 flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">참여 파트너:</div>
                  <div className="flex -space-x-2">
                    {solution.companies?.map((company, i) => (
                      <div key={company.id} className="w-8 h-8 rounded-full border-2 border-background bg-secondary flex items-center justify-center relative z-10" style={{ zIndex: 10 - i }} title={company.name}>
                        {company.type === 'hardware' ? <Factory className="w-3.5 h-3.5 text-amber-500" /> : <Monitor className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                    ))}
                  </div>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
