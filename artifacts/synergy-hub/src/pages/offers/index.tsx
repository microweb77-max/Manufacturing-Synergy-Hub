import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSupplyOffers,
  useCreateSupplyOffer,
  useCreateOfferMatch,
  useListCompanies,
  useListClientCompanies,
  getListSupplyOffersQueryKey,
} from "@workspace/api-client-react";
import type { SupplyOffer } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Package,
  Factory,
  Handshake,
  Tag,
  Boxes,
} from "lucide-react";

const CATEGORIES = ["원재료", "자재", "부자재", "기타"];
const ALL = "__all__";

const categoryColor: Record<string, string> = {
  원재료: "bg-amber-500/10 text-amber-600",
  자재: "bg-blue-500/10 text-blue-600",
  부자재: "bg-purple-500/10 text-purple-600",
  기타: "bg-slate-500/10 text-slate-600",
};

export default function OffersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: offers, isLoading } = useListSupplyOffers();
  const { data: companies } = useListCompanies({});
  const { data: clientCompanies } = useListClientCompanies();
  const createOffer = useCreateSupplyOffer();
  const createMatch = useCreateOfferMatch();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);

  const [offerOpen, setOfferOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<SupplyOffer | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListSupplyOffersQueryKey() });

  const filtered = useMemo(() => {
    const list = offers ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((o) => {
      if (category !== ALL && o.category !== category) return false;
      if (!q) return true;
      return (
        o.itemName.toLowerCase().includes(q) ||
        o.companyName.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    });
  }, [offers, search, category]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            오퍼 리스트
          </h1>
          <p className="text-muted-foreground mt-1">
            협력사가 공급 가능한 원재료·자재·부자재 품목과 단가입니다. 관심 품목에 매칭을 요청하세요.
          </p>
        </div>
        <Button onClick={() => setOfferOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          공급 오퍼 등록
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-card p-4 border rounded-lg shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="품명 · 공급기업 · 설명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="분류" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>모든 분류</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground border rounded-lg bg-card">
          <Boxes className="h-10 w-10 mx-auto mb-3 opacity-40" />
          등록된 공급 오퍼가 없습니다. 첫 오퍼를 등록해보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o) => (
            <Card key={o.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={categoryColor[o.category] ?? ""}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {o.category}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-snug pt-1">
                  {o.itemName}
                </CardTitle>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Factory className="h-3.5 w-3.5" />
                  {o.companyName || "미지정"}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold font-mono text-primary">
                    {o.unitPrice || "-"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {o.currency}
                    {o.unit ? ` / ${o.unit}` : ""}
                  </span>
                </div>
                {o.minOrderQty && (
                  <p className="text-xs text-muted-foreground">
                    최소 주문: {o.minOrderQty}
                  </p>
                )}
                {o.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {o.description}
                  </p>
                )}
                <div className="mt-auto pt-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setMatchTarget(o)}
                  >
                    <Handshake className="h-4 w-4 mr-2" />
                    매칭 요청
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OfferCreateDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        companies={(companies ?? []).map((c) => ({ id: c.id, name: c.name }))}
        submitting={createOffer.isPending}
        onSubmit={async (body) => {
          try {
            await createOffer.mutateAsync({ data: body });
            toast({ title: "등록 완료", description: "공급 오퍼가 등록되었습니다." });
            invalidate();
            setOfferOpen(false);
          } catch {
            toast({
              title: "오류",
              description: "오퍼 등록에 실패했습니다.",
              variant: "destructive",
            });
          }
        }}
      />

      <MatchRequestDialog
        offer={matchTarget}
        onClose={() => setMatchTarget(null)}
        clientCompanies={(clientCompanies ?? []).map((c) => ({
          no: c.no,
          nameKo: c.nameKo,
          region: c.region,
        }))}
        submitting={createMatch.isPending}
        onSubmit={async (body) => {
          try {
            await createMatch.mutateAsync({ data: body });
            toast({
              title: "매칭 요청 접수",
              description:
                "매칭 요청이 접수되었습니다. 담당자가 검토 후 연락드립니다.",
            });
            setMatchTarget(null);
          } catch {
            toast({
              title: "오류",
              description: "매칭 요청에 실패했습니다.",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}

type OfferBody = {
  companyId: number;
  category: string;
  itemName: string;
  unitPrice: string;
  unit: string;
  currency: string;
  minOrderQty: string;
  description: string;
};

function OfferCreateDialog({
  open,
  onOpenChange,
  companies,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: { id: number; name: string }[];
  submitting: boolean;
  onSubmit: (body: OfferBody) => void;
}) {
  const [companyId, setCompanyId] = useState("");
  const [category, setCategory] = useState("원재료");
  const [itemName, setItemName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [unit, setUnit] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [minOrderQty, setMinOrderQty] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCompanyId("");
    setCategory("원재료");
    setItemName("");
    setUnitPrice("");
    setUnit("");
    setCurrency("USD");
    setMinOrderQty("");
    setDescription("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!companyId) return setError("공급기업을 선택하세요.");
    if (!itemName.trim()) return setError("품명을 입력하세요.");
    setError(null);
    onSubmit({
      companyId: parseInt(companyId, 10),
      category,
      itemName: itemName.trim(),
      unitPrice: unitPrice.trim(),
      unit: unit.trim(),
      currency: currency.trim() || "USD",
      minOrderQty: minOrderQty.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>공급 오퍼 등록</DialogTitle>
          <DialogDescription>
            기업 디렉토리에 등록된 공급기업으로서 공급 가능한 품목과 단가를 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              공급기업 <span className="text-destructive">*</span>
            </Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="기업 디렉토리에서 선택" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>분류</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>
              품명 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="예: 알루미늄 6061 빌렛"
            />
          </div>
          <div className="space-y-1.5">
            <Label>단가</Label>
            <Input
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="예: 3.20"
            />
          </div>
          <div className="space-y-1.5">
            <Label>통화</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="USD"
            />
          </div>
          <div className="space-y-1.5">
            <Label>단위</Label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="예: kg, ea, m"
            />
          </div>
          <div className="space-y-1.5">
            <Label>최소 주문 수량</Label>
            <Input
              value={minOrderQty}
              onChange={(e) => setMinOrderQty(e.target.value)}
              placeholder="예: 500kg"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="규격, 품질, 납기 등"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "저장 중..." : "등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MatchBody = {
  offerId: number;
  clientCompanyNo: number | null;
  clientCompanyName: string;
  contactName: string;
  contactInfo: string;
  message: string;
};

function MatchRequestDialog({
  offer,
  onClose,
  clientCompanies,
  submitting,
  onSubmit,
}: {
  offer: SupplyOffer | null;
  onClose: () => void;
  clientCompanies: { no: number; nameKo: string; region: string }[];
  submitting: boolean;
  onSubmit: (body: MatchBody) => void;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [manualName, setManualName] = useState<string | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = clientCompanies.find((c) => c.no === selectedNo) ?? null;
  const hasSelection = selected !== null || manualName !== null;

  const matches = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return [];
    return clientCompanies
      .filter((c) => c.nameKo.toLowerCase().includes(q))
      .slice(0, 8);
  }, [clientCompanies, clientSearch]);

  const reset = () => {
    setClientSearch("");
    setSelectedNo(null);
    setManualName(null);
    setContactName("");
    setContactInfo("");
    setMessage("");
    setError(null);
  };

  const clearSelection = () => {
    setSelectedNo(null);
    setManualName(null);
    setClientSearch("");
  };

  const handleSubmit = () => {
    if (!offer) return;
    const companyName = selected ? selected.nameKo : manualName;
    if (!companyName) return setError("고객사를 선택하거나 직접 입력하세요.");
    setError(null);
    onSubmit({
      offerId: offer.id,
      clientCompanyNo: selected ? selected.no : null,
      clientCompanyName: companyName,
      contactName: contactName.trim(),
      contactInfo: contactInfo.trim(),
      message: message.trim(),
    });
  };

  return (
    <Dialog
      open={!!offer}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>매칭 요청</DialogTitle>
          <DialogDescription>
            {offer && (
              <>
                <span className="font-medium text-foreground">
                  {offer.itemName}
                </span>{" "}
                ({offer.companyName}) 품목에 대한 매칭을 요청합니다.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>
              고객사 (귀사) 선택 <span className="text-destructive">*</span>
            </Label>
            {hasSelection ? (
              <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-muted/40">
                <div className="text-sm">
                  <div className="font-medium">
                    {selected ? selected.nameKo : manualName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {selected ? selected.region : "직접 입력"}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  변경
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="고객사 디렉토리에서 기업명 검색..."
                />
                {matches.length > 0 && (
                  <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                    {matches.map((c) => (
                      <button
                        key={c.no}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
                        onClick={() => setSelectedNo(c.no)}
                      >
                        <div className="text-sm font-medium">{c.nameKo}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.region}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {clientSearch.trim() && matches.length === 0 && (
                  <div className="border rounded-md px-3 py-3 space-y-2 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      검색 결과가 없습니다. 디렉토리에 없는 기업은 직접 입력할 수 있습니다.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setManualName(clientSearch.trim())}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />'{clientSearch.trim()}'
                      직접 입력
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>담당자명</Label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="예: 김철수 과장"
            />
          </div>
          <div className="space-y-1.5">
            <Label>연락처</Label>
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="이메일 또는 전화번호"
            />
          </div>
          <div className="space-y-1.5">
            <Label>요청 메시지</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="필요 수량, 납기, 문의사항 등"
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "요청 중..." : "매칭 요청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
