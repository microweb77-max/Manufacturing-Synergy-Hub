import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useBulkUpdateCompanies, type Company, type CompanyBulkUpdateResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildBulkPreview, downloadCurrentData, readExcel, type BulkPreview } from "./companyBulkUpdate";

const SAMPLE_COUNT = 10;
const CHUNK = 500;

export function CompanyBulkUpdateDialog({ companies, disabled }: { companies: Company[] | undefined; disabled: boolean }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const bulk = useBulkUpdateCompanies();
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [result, setResult] = useState<CompanyBulkUpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reset = () => { setPreview(null); setResult(null); setError(null); setFilename(""); };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || lock.current || !companies) return;
    lock.current = true; setBusy(true); setPreview(null); setResult(null); setError(null); setFilename(file.name);
    try {
      const grid = await readExcel(file);
      const next = buildBulkPreview(grid, companies);
      if (mounted.current) setPreview(next);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  };

  // Valid rows are applied in chunks; each chunk is one server transaction. Stop on first failure.
  const apply = async () => {
    if (lock.current || !preview?.items.length) return;
    lock.current = true; setBusy(true); setError(null);
    const total: CompanyBulkUpdateResult = { updated: 0, skipped: 0, errors: [...preview.errors] };
    try {
      for (let i = 0; i < preview.items.length; i += CHUNK) {
        const res = await bulk.mutateAsync({ data: { items: preview.items.slice(i, i + CHUNK) as never } });
        total.updated += res.updated; total.skipped += res.skipped; total.errors.push(...res.errors);
      }
    } catch {
      if (mounted.current) setError(`적용 중 오류가 발생했습니다. 현재까지 ${total.updated.toLocaleString()}건이 반영되었습니다. 목록을 확인한 뒤 다시 시도하세요.`);
    } finally {
      void queryClient.invalidateQueries();
      lock.current = false;
      if (mounted.current) { setResult(total); setPreview(null); setBusy(false); }
    }
  };

  const errorList = result?.errors ?? preview?.errors ?? [];
  return (
    <Dialog open={open} onOpenChange={(next) => { if (lock.current) return; setOpen(next); if (next) reset(); }}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => { reset(); setOpen(true); }}>
        <RefreshCw className="mr-1.5 h-4 w-4" />일괄 수정
      </Button>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => { if (lock.current) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>기업 일괄 수정</DialogTitle>
          <DialogDescription>
            내보낸 엑셀의 id로 기존 회원사를 찾아 <b>값을 입력한 열만</b> 덮어씁니다. 빈 셀은 기존 값을 유지하며, 지우려면 (비움)을 입력하세요. 새 회원사는 만들지 않습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" size="sm" disabled={busy || !companies} onClick={async () => {
            if (!companies || lock.current) return;
            lock.current = true; setBusy(true); setError(null);
            try { await downloadCurrentData(companies); } catch { setError("파일을 내려받지 못했습니다. 다시 시도해 주세요."); }
            finally { lock.current = false; if (mounted.current) setBusy(false); }
          }}>
            <Download className="mr-1.5 h-4 w-4" />현재 데이터 내보내기
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>수정한 엑셀 파일 선택</Label>
            <Input id={inputId} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={chooseFile} />
          </div>
          {filename && <p className="text-xs text-muted-foreground break-all">{filename}</p>}
          <div aria-live="polite" role="status" className="text-sm">
            {busy && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
            {result ? `적용 완료: 성공 ${result.updated.toLocaleString()}건 / 변경 없음 ${result.skipped.toLocaleString()}건 / 실패 ${result.errors.length.toLocaleString()}건`
              : preview ? `${preview.items.length.toLocaleString()}건이 수정됩니다.${preview.columns.length ? ` 변경 열: ${preview.columns.join(", ")}.` : ""} 나머지 ${preview.unchanged.toLocaleString()}건은 변경 없음${preview.errors.length ? `, 오류 ${preview.errors.length.toLocaleString()}건(적용 시 건너뜀)` : ""}.`
                : busy ? "처리 중..." : "파일을 선택하면 적용 전 미리보기가 표시됩니다."}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {!!errorList.length && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">{result ? "실패한 행" : "건너뛸 행 (적용되지 않음)"}</p>
            <ul className="mt-1 list-inside list-disc">
              {errorList.slice(0, 20).map((e, i) => <li key={i}>{e.row}행: {e.reason}</li>)}
            </ul>
            {errorList.length > 20 && <p className="mt-1">외 {errorList.length - 20}건</p>}
          </div>}
          {preview && !!preview.changed.length && <div className="space-y-1">
            <p className="text-xs text-muted-foreground">샘플 {Math.min(SAMPLE_COUNT, preview.changed.length)}건 (변경 전 → 변경 후)</p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>행</TableHead><TableHead>id</TableHead><TableHead>기업명</TableHead><TableHead>변경 내용</TableHead></TableRow></TableHeader>
                <TableBody>{preview.changed.slice(0, SAMPLE_COUNT).map((c) => <TableRow key={c.id}>
                  <TableCell>{c.row}</TableCell><TableCell>{c.id}</TableCell><TableCell className="whitespace-nowrap">{c.name}</TableCell>
                  <TableCell className="text-xs">{c.changes.map((x) => <div key={x.label} className="break-all"><b>{x.label}</b>: {x.before || "(빈 값)"} → {x.after || "(빈 값)"}</div>)}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
          <Button disabled={busy || !preview || !preview.items.length} onClick={apply}>
            {busy && preview ? "적용 중..." : `${preview?.items.length.toLocaleString() ?? 0}건 적용`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
