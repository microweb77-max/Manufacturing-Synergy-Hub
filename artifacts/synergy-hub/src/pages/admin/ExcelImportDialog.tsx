import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminField, FormValues } from "./AdminSection";
import { downloadTemplate, readExcel, validateImport, type ImportRow } from "./excelImport";

export type CreateOptions = { silent?: boolean };

type Props = {
  title: string;
  fields: AdminField[];
  defaults: FormValues;
  existing: FormValues[];
  disabled: boolean;
  onCreate: (values: FormValues, options?: CreateOptions) => Promise<void>;
};

export function ExcelImportDialog({ title, fields, defaults, existing, disabled, onCreate }: Props) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || lock.current) return;
    lock.current = true;
    setBusy(true);
    setRows([]);
    setFinished(false);
    setError(null);
    setFilename(file.name);
    try {
      const grid = await readExcel(file);
      const parsed = validateImport(grid, fields, defaults, existing);
      if (mounted.current) setRows(parsed);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "파일을 읽지 못했습니다.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const save = async () => {
    if (lock.current || finished || !rows.length || rows.some((r) => r.errors.length || r.status !== "pending")) return;
    lock.current = true;
    setBusy(true);
    setSaving(true);
    setError(null);
    // Keep a local result as well as UI state; do not retry ambiguous network failures.
    const result = rows.map((r) => ({ ...r }));
    try {
      for (let index = 0; index < result.length && mounted.current; index++) {
        try {
          await onCreate(result[index].values, { silent: true });
          result[index].status = "saved";
        } catch {
          result[index].status = "uncertain";
          setError(`${result[index].line}행에서 저장을 확인하지 못해 중단했습니다. 완료된 행은 다시 보내지 않습니다. 목록에서 해당 행의 저장 여부를 확인한 뒤, 아직 없는 항목만 새 파일로 업로드해 주세요.`);
          break;
        }
        if (mounted.current) setRows(result.map((r) => ({ ...r })));
      }
    } finally {
      // Includes the partially successful case and updates dashboard/list caches.
      void queryClient.invalidateQueries();
      lock.current = false;
      if (mounted.current) {
        setRows(result);
        setFinished(true);
        setSaving(false);
        setBusy(false);
      }
    }
  };

  const errors = rows.filter((r) => r.errors.length);
  const saved = rows.filter((r) => r.status === "saved").length;
  const editable = fields.filter((f) => f.type !== "readonly");
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (lock.current) return;
      setOpen(next);
      if (next) { setRows([]); setFilename(""); setError(null); setFinished(false); }
    }}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => {
        setRows([]); setFilename(""); setError(null); setFinished(false); setOpen(true);
      }}>
        <Upload className="mr-1.5 h-4 w-4" />
        엑셀 업로드
      </Button>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(event) => { if (lock.current) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{title} 엑셀 업로드</DialogTitle>
          <DialogDescription>
            기존 항목은 수정·삭제하지 않고 새 항목을 추가합니다. 양식의 첫 번째 시트에 데이터를 입력하세요.
            .xlsx · 최대 5MB · 2,000행. 선택 필드는 생략 시 기본값이 적용됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
            if (lock.current) return;
            lock.current = true; setBusy(true); setError(null);
            try { await downloadTemplate(title, fields, defaults); }
            catch { setError("양식을 내려받지 못했습니다. 다시 시도해 주세요."); }
            finally { lock.current = false; if (mounted.current) setBusy(false); }
          }}>
            <Download className="mr-1.5 h-4 w-4" />양식 다운로드
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>엑셀 파일 선택</Label>
            <Input id={inputId} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={chooseFile} />
          </div>
          {filename && <p className="text-xs text-muted-foreground break-all">{filename}</p>}
          <div aria-live="polite" role="status" className="text-sm">
            {busy && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
            {saving ? `추가 중: ${saved.toLocaleString()} / ${rows.length.toLocaleString()}건. 이 페이지를 유지해 주세요.`
              : finished ? `${saved.toLocaleString()}건 추가 완료${saved < rows.length ? ` · 나머지 ${rows.length - saved}건은 저장 여부 확인 필요` : ""}`
                : rows.length ? `${rows.length.toLocaleString()}행 검증 · 오류 ${errors.length.toLocaleString()}행` : busy ? "파일 처리 중..." : "파일을 선택한 뒤 검증 결과를 확인하세요."}
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {!!errors.length && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">오류가 있어 아직 추가할 수 없습니다. 파일을 수정한 뒤 다시 선택하세요.</p>
            <ul className="mt-1 list-inside list-disc">
              {errors.slice(0, 10).map((r) => <li key={r.line}>{r.line}행: {r.errors.join(" ")}</li>)}
            </ul>
            {errors.length > 10 && <p className="mt-1">외 {errors.length - 10}행에 오류가 있습니다.</p>}
          </div>}
          {!!rows.length && <div className="space-y-1">
            <p className="text-xs text-muted-foreground">앞 20행 미리보기 · 전체 {rows.length.toLocaleString()}행을 검증했습니다. 가로로 스크롤하여 모든 항목을 확인하세요.</p>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>엑셀 행</TableHead>{editable.map((f) => <TableHead className="whitespace-nowrap" key={f.name}>{f.label}</TableHead>)}<TableHead>결과</TableHead></TableRow></TableHeader>
                <TableBody>{rows.slice(0, 20).map((r) => <TableRow key={r.line}>
                  <TableCell>{r.line}</TableCell>
                  {editable.map((f) => <TableCell className="min-w-28 max-w-64 truncate" title={r.values[f.name]} key={f.name}>{f.options?.find((o) => o.value === r.values[f.name])?.label ?? (r.values[f.name] || "-")}</TableCell>)}
                  <TableCell className={`whitespace-nowrap ${r.errors.length || r.status === "uncertain" ? "text-destructive" : ""}`}>{r.errors.length ? "오류" : r.status === "saved" ? "추가 완료" : r.status === "uncertain" ? "저장 확인 필요" : "대기"}</TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
          </div>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
          <Button disabled={busy || finished || !!error || !rows.length || !!errors.length} onClick={save}>
            {saving ? "추가 중..." : `${rows.length.toLocaleString()}건 추가`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
