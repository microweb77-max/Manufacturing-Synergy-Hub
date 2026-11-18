import { useMemo, useState } from "react";
import {
  useListNews,
  getListNewsQueryKey,
  type NewsArticle,
} from "@workspace/api-client-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Newspaper,
  ExternalLink,
  Calendar,
  Filter,
} from "lucide-react";

const ALL = "__all__";

const CATEGORY_STYLES: Record<string, string> = {
  "투자·FDI": "bg-emerald-100 text-emerald-800",
  "생산·공장": "bg-blue-100 text-blue-800",
  "자동화·기술": "bg-violet-100 text-violet-800",
  "전자·반도체": "bg-cyan-100 text-cyan-800",
  "물류·공급망": "bg-amber-100 text-amber-800",
  "무역·수출": "bg-rose-100 text-rose-800",
  산업단지: "bg-teal-100 text-teal-800",
  기타: "bg-slate-100 text-slate-700",
};

function categoryClass(category: string): string {
  return CATEGORY_STYLES[category] ?? CATEGORY_STYLES["기타"];
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function NewsPage() {
  // Other sessions can receive new articles while this page remains open.
  const { data: articles, isLoading } = useListNews({
    query: { queryKey: getListNewsQueryKey(), refetchInterval: 60_000, refetchOnWindowFocus: true },
  });

  const [category, setCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles ?? []) {
      const c = a.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [articles]);

  const filtered = useMemo(() => {
    if (category === ALL) return articles ?? [];
    return (articles ?? []).filter((a) => a.category?.trim() === category);
  }, [articles, category]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-primary" />
            최근 소식
          </h1>
          <p className="mt-2 text-muted-foreground">
            베트남 제조산업 관련 최신 뉴스를 자동으로 수집하여 한국어로 번역해
            제공합니다.
          </p>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-2 pt-2">
          <Calendar className="h-4 w-4 shrink-0" />
          자동 갱신 일정: 매일 자정 00:00 · 베트남 시간
        </p>
      </div>

      {categories.length > 0 && (
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setCategory(ALL)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              category === ALL
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            전체
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">
                아직 수집된 뉴스가 없습니다.
              </p>
              <p className="text-sm text-muted-foreground/70">
                 자동 수집이 완료되면 최신 뉴스가 표시됩니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((article: NewsArticle) => (
            <Card key={article.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className={`${categoryClass(article.category)} border-0`}
                  >
                    {article.category || "기타"}
                  </Badge>
                  {article.source && (
                    <span className="text-xs text-muted-foreground">
                      {article.source}
                    </span>
                  )}
                  {article.publishedAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {article.publishedAt}
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg leading-snug mt-2">
                  {article.title}
                </CardTitle>
                {article.originalTitle && (
                  <p className="text-xs text-muted-foreground/70 italic">
                    {article.originalTitle}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {article.summary && (
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {article.summary}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    수집일 {formatCreatedAt(article.createdAt)}
                  </span>
                  {article.sourceUrl && (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      원문 보기
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
