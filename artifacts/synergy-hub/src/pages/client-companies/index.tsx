import { useMemo, useState } from "react";
import { useListCompanies } from "@workspace/api-client-react";
import type { Company } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Building2,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Tag,
} from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";

export default function ClientCompaniesPage() {
  const { data: allCompanies, isLoading } = useListCompanies({ type: "customer" });
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Company | null>(null);

  const companies = allCompanies ?? [];

  // Extract province from location (format: "Province — Address")
  const getRegion = (c: Company) => c.location.split("—")[0].trim();
  const getCategory = (c: Company) => c.description;

  const regions = useMemo(
    () =>
      [...new Set(companies.map(getRegion).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "en"),
      ),
    [companies],
  );

  const categories = useMemo(
    () =>
      [...new Set(companies.map(getCategory).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "en"),
      ),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (region !== ALL && getRegion(c) !== region) return false;
      if (category !== ALL && getCategory(c) !== category) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.contactEmail.toLowerCase().includes(q)
      );
    });
  }, [companies, search, region, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const resetPage = () => setPage(1);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          고객사 디렉토리
        </h1>
        <p className="text-muted-foreground mt-1">
          베트남 진출 한국 제조기업 리스트 (총 {companies.length.toLocaleString()}개사 · 출처: KOCHAM 2025)
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 bg-card p-4 border rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="기업명 · 주소 · 이메일 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="pl-9"
          />
        </div>
        <div className="w-full lg:w-[200px]">
          <Select
            value={region}
            onValueChange={(v) => {
              setRegion(v);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="진출지역" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value={ALL}>모든 지역</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full lg:w-[260px]">
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="업종" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value={ALL}>모든 업종</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          총 <span className="font-semibold text-foreground">{filtered.length.toLocaleString()}</span>개 기업
        </span>
        <span>
          {currentPage} / {totalPages} 페이지
        </span>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[56px]">No.</TableHead>
              <TableHead>기업명</TableHead>
              <TableHead>업종</TableHead>
              <TableHead>진출지역</TableHead>
              <TableHead className="hidden lg:table-cell">주소</TableHead>
              <TableHead className="hidden xl:table-cell">연락처</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : pageItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-16 text-muted-foreground"
                >
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  조건에 맞는 기업이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((c, idx) => {
                const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const province = getRegion(c);
                const address = c.location.includes("—")
                  ? c.location.split("—")[1].trim()
                  : "";
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rowNum}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                    </TableCell>
                    <TableCell>
                      {c.description ? (
                        <Badge variant="secondary" className="font-normal">
                          {c.description}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {province || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[260px]">
                      <span className="line-clamp-2">{address || "-"}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                      {c.phone || c.contactEmail || "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전
          </Button>
          <span className="text-sm text-muted-foreground px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            다음
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-2">
                  <Building2 className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div className="min-w-0">
                    <DialogTitle className="text-xl">{selected.name}</DialogTitle>
                    {selected.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary">{selected.description}</Badge>
                      </p>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 pt-2">
                {selected.location && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{selected.location}</span>
                  </div>
                )}
                {selected.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selected.phone}</span>
                  </div>
                )}
                {selected.contactEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selected.contactEmail}`}
                      className="text-primary hover:underline"
                    >
                      {selected.contactEmail}
                    </a>
                  </div>
                )}
                {selected.capabilityTags.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {selected.capabilityTags.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
