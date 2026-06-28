import { useMemo, useState } from "react";
import { useListClientCompanies } from "@workspace/api-client-react";
import type { ClientCompany } from "@workspace/api-client-react";
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
  Briefcase,
  Factory,
  Network,
  Landmark,
  Mailbox,
  Hash,
} from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";

export default function ClientCompaniesPage() {
  const { data, isLoading } = useListClientCompanies();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState(ALL);
  const [industry, setIndustry] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ClientCompany | null>(null);

  const companies = data ?? [];

  const regions = useMemo(
    () =>
      [...new Set(companies.map((c) => c.region).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "ko"),
      ),
    [companies],
  );
  const industries = useMemo(
    () =>
      [...new Set(companies.map((c) => c.industry).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "ko"),
      ),
    [companies],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (region !== ALL && c.region !== region) return false;
      if (industry !== ALL && c.industry !== industry) return false;
      if (!q) return true;
      return (
        c.nameKo.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.parentCompany.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [companies, search, region, industry]);

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
          베트남 진출 한국 FDI 제조기업 리스트 (총 {companies.length.toLocaleString()}개사 · 출처: KOTRA 해외진출 한국기업 디렉토리 2024.12)
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 bg-card p-4 border rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="기업명(국문/영문) · 모기업 · 주소 검색..."
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
        <div className="w-full lg:w-[200px]">
          <Select
            value={industry}
            onValueChange={(v) => {
              setIndustry(v);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="업종" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value={ALL}>모든 업종</SelectItem>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
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
              <TableHead className="hidden md:table-cell">모기업</TableHead>
              <TableHead>업종</TableHead>
              <TableHead>진출지역</TableHead>
              <TableHead className="hidden lg:table-cell">진출형태</TableHead>
              <TableHead className="hidden xl:table-cell">주소</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : pageItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-16 text-muted-foreground"
                >
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  조건에 맞는 기업이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((c) => (
                <TableRow
                  key={c.no}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.no}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{c.nameKo || "-"}</div>
                    {c.nameEn && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {c.nameEn}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {c.parentCompany ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        {c.parentCompany}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {c.industry ? (
                      <Badge variant="secondary" className="font-normal">
                        {c.industry}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {c.region || "-"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {c.entryType || "-"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-xs text-muted-foreground max-w-[260px]">
                    <span className="line-clamp-2">{c.address || "-"}</span>
                  </TableCell>
                </TableRow>
              ))
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
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-2">
                  <Building2 className="h-6 w-6 text-primary shrink-0 mt-1" />
                  <div className="min-w-0">
                    <DialogTitle className="text-xl">
                      {selected.nameKo || "\u00A0"}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground break-words">
                      {selected.nameEn}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex flex-wrap gap-2 pt-1">
                {selected.industry && (
                  <Badge variant="secondary">{selected.industry}</Badge>
                )}
                {selected.entryType && (
                  <Badge variant="outline">{selected.entryType}</Badge>
                )}
                {selected.investmentType && (
                  <Badge variant="outline">{selected.investmentType}</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <DetailRow icon={Hash} label="번호" value={String(selected.no)} />
                <DetailRow
                  icon={Briefcase}
                  label="모기업"
                  value={selected.parentCompany}
                />
                <DetailRow
                  icon={Factory}
                  label="진출형태"
                  value={selected.entryType}
                />
                <DetailRow
                  icon={Landmark}
                  label="투자형태"
                  value={selected.investmentType}
                />
                <DetailRow
                  icon={Network}
                  label="업종"
                  value={selected.industry}
                />
                <DetailRow
                  icon={Network}
                  label="업종 상세"
                  value={selected.industryDetail}
                />
                <DetailRow
                  icon={MapPin}
                  label="진출지역"
                  value={selected.region}
                />
                <DetailRow
                  icon={Mailbox}
                  label="우편번호"
                  value={selected.postalCode}
                />
                <div className="sm:col-span-2">
                  <DetailRow
                    icon={MapPin}
                    label="주소"
                    value={selected.address}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm break-words min-h-[1.25rem]">{value}</div>
    </div>
  );
}
