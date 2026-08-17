import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useListCompanies } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, MapPin, Star, ShieldCheck, Factory, ChevronLeft, ChevronRight } from "lucide-react";
import { getCompanyTypeMeta } from "@/lib/companyType";

const PAGE_SIZE = 9;

export default function CompaniesList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"supplier" | "hardware" | "software" | "service" | "all">("supplier");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);

  const { data: companies, isLoading } = useListCompanies({
    search: search || undefined,
    type: type !== "all" ? type : undefined,
    tag: tag || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [search, type, tag]);

  const total = companies?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageItems = useMemo(
    () => companies?.slice(pageStart, pageStart + PAGE_SIZE) ?? [],
    [companies, pageStart],
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">공급사 디렉토리</h1>
          <p className="text-muted-foreground mt-1">시너지 허브에 등록된 협력사 목록을 확인하고 파트너를 찾으세요.</p>
        </div>
        <Link href="/companies/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            새 기업 등록
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 border rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="기업명 검색..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={type} onValueChange={(val: any) => setType(val)}>
            <SelectTrigger>
              <SelectValue placeholder="기업 유형" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모든 유형</SelectItem>
              <SelectItem value="supplier">공급사</SelectItem>
              <SelectItem value="hardware">하드웨어 (Hardware)</SelectItem>
              <SelectItem value="software">소프트웨어 (Software)</SelectItem>
              <SelectItem value="service">서비스 (Service)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <Input 
            placeholder="역량 태그 검색..." 
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="h-[280px]">
              <CardHeader><Skeleton className="h-6 w-2/3" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      ) : companies?.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
          <Factory className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">검색 결과가 없습니다</h3>
          <p className="text-muted-foreground mt-1">다른 검색 조건으로 시도해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pageItems.map(company => (
            <Link key={company.id} href={`/companies/${company.id}`}>
              <Card className="h-full hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">{company.name}</CardTitle>
                    {(() => {
                      const meta = getCompanyTypeMeta(company.type);
                      const TypeIcon = meta.icon;
                      return (
                        <Badge variant="secondary" className={meta.badgeClass}>
                          <TypeIcon className="w-3 h-3 mr-1" /> {meta.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground mt-2 space-x-3">
                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {company.location}</span>
                    <span className="flex items-center text-amber-500"><Star className="w-3 h-3 mr-1 fill-current" /> {company.rating.toFixed(1)}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <CardDescription className="line-clamp-2 mb-4 text-foreground/80 flex-1">
                    {company.description}
                  </CardDescription>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {company.capabilityTags.slice(0, 4).map(tag => (
                        <Badge key={tag} variant="outline" className="bg-background text-xs font-normal">{tag}</Badge>
                      ))}
                      {company.capabilityTags.length > 4 && (
                        <Badge variant="outline" className="bg-background text-xs font-normal">+{company.capabilityTags.length - 4}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">신뢰 점수</span>
                        <div className="flex items-center font-mono font-medium text-sm">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 mr-1.5" />
                          {company.trustScore}
                        </div>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">프로젝트</span>
                        <span className="font-mono font-medium text-sm">{company.projectsCompleted}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            총 {total}개 중 {pageStart + 1}–{pageStart + pageItems.length}개 표시
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>
              <span className="px-1">
                {currentPage} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
