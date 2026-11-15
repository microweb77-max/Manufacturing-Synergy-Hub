import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Plus,
  Pencil,
  Trash2,
  Inbox,
  Search,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  ImagePlus,
} from "lucide-react";

export type FormValues = Record<string, string>;

export type AdminField = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "tags" | "image" | "readonly";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function AdminImageField({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];
    if (!allowed.includes(file.type)) {
      setErr("이미지(PNG, JPG, WEBP, GIF) 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErr("2MB 이하의 이미지를 업로드해주세요.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setErr(null);
      setBroken(false);
      onChange(dataUrl);
    } catch {
      setErr("이미지를 읽는 중 문제가 발생했습니다.");
    }
  };

  const hasValue = Boolean(value);

  return (
    <div className="space-y-2">
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder ?? "이미지 URL 입력 또는 파일 업로드"}
        onChange={(e) => {
          setBroken(false);
          setErr(null);
          onChange(e.target.value);
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      <div className="flex items-center gap-3">
        {hasValue && !broken && (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
            <img
              src={value}
              alt="미리보기"
              className="h-full w-full object-contain"
              onError={() => setBroken(true)}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {hasValue ? "이미지 변경" : "이미지 업로드"}
          </Button>
          {hasValue && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => {
                setBroken(false);
                onChange("");
              }}
            >
              <X className="h-4 w-4" />
              제거
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        URL을 직접 입력하거나 이미지 파일을 업로드하세요. (PNG, JPG, WEBP, GIF · 최대 2MB)
      </p>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

export type AdminColumn<T> = {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  /** When provided, the column header becomes clickable to sort by this value. */
  sortValue?: (item: T) => string | number;
};

export type AdminFilter<T> = {
  /** Stable key used as the filter's react key + state key. */
  key: string;
  label: string;
  options: { value: string; label: string }[];
  getValue: (item: T) => string;
};

export type AdminSectionProps<T> = {
  title: string;
  description?: string;
  items: T[] | undefined;
  isLoading: boolean;
  columns: AdminColumn<T>[];
  fields: AdminField[];
  getId: (item: T) => number;
  getRowLabel: (item: T) => string;
  toFormValues: (item: T) => FormValues;
  emptyValues: FormValues;
  onCreate: (values: FormValues) => Promise<void>;
  onUpdate: (id: number, values: FormValues) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  canCreate?: boolean;
  /** Returns the text searched by the toolbar search box. Defaults to the row label. */
  getSearchText?: (item: T) => string;
  searchPlaceholder?: string;
  filters?: AdminFilter<T>[];
  /** Rows shown per page (client-side pagination). Defaults to 10. */
  pageSize?: number;
  /** Extra controls rendered in the section header (e.g. an import/collect button). */
  headerActions?: ReactNode;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

export function AdminSection<T>({
  title,
  description,
  items,
  isLoading,
  columns,
  fields,
  getId,
  getRowLabel,
  toFormValues,
  emptyValues,
  onCreate,
  onUpdate,
  onDelete,
  canCreate = true,
  getSearchText,
  searchPlaceholder,
  filters,
  pageSize = 10,
  headerActions,
}: AdminSectionProps<T>) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);

  const sortColumn = sort
    ? columns.find((c) => c.key === sort.key)
    : undefined;

  const processed = useMemo(() => {
    let list = items ? [...items] : [];

    const q = query.trim().toLowerCase();
    if (q) {
      const text = getSearchText ?? getRowLabel;
      list = list.filter((item) => text(item).toLowerCase().includes(q));
    }

    if (filters) {
      for (const f of filters) {
        const fv = filterValues[f.key];
        if (fv && fv !== "__all__") {
          list = list.filter((item) => f.getValue(item) === fv);
        }
      }
    }

    if (sort && sortColumn?.sortValue) {
      const getV = sortColumn.sortValue;
      list.sort((a, b) => {
        const av = getV(a);
        const bv = getV(b);
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else {
          cmp = String(av).localeCompare(String(bv), "ko");
        }
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [
    items,
    query,
    filters,
    filterValues,
    sort,
    sortColumn,
    getSearchText,
    getRowLabel,
  ]);

  const total = processed.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = processed.slice(pageStart, pageStart + pageSize);

  const hasActiveFilters =
    query.trim().length > 0 ||
    Object.values(filterValues).some((v) => v && v !== "__all__");

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  const resetFilters = () => {
    setQuery("");
    setFilterValues({});
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setValues(emptyValues);
    setError(null);
    setOpen(true);
  };

  const openEdit = (item: T) => {
    setEditing(item);
    setValues(toFormValues(item));
    setError(null);
    setOpen(true);
  };

  const handleSubmit = async () => {
    const missing = fields.filter(
      (f) => f.required && !(values[f.name] ?? "").trim(),
    );
    if (missing.length > 0) {
      setError(`필수 항목을 입력하세요: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (editing) {
        await onUpdate(getId(editing), values);
      } else {
        await onCreate(values);
      }
      setOpen(false);
    } catch {
      // error toast handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const colSpan = columns.length + 2;
  const showToolbar = Boolean(getSearchText) || Boolean(filters?.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {canCreate && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              새 항목 추가
            </Button>
          )}
        </div>
      </div>

      {showToolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {getSearchText && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder ?? "검색..."}
                className="pl-8"
              />
            </div>
          )}
          {filters?.map((f) => (
            <Select
              key={f.key}
              value={filterValues[f.key] ?? "__all__"}
              onValueChange={(v) => {
                setFilterValues((prev) => ({ ...prev, [f.key]: v }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-auto min-w-[140px]">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{f.label}: 전체</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-4 w-4" />
              초기화
            </Button>
          )}
        </div>
      )}

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              {columns.map((c) => (
                <TableHead key={c.key}>
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colSpan}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : total === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  {hasActiveFilters
                    ? "조건에 맞는 데이터가 없습니다."
                    : "데이터가 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((item) => (
                <TableRow key={getId(item)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {getId(item)}
                  </TableCell>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="align-top">
                      {c.render(item)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="수정"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>삭제 확인</AlertDialogTitle>
                          <AlertDialogDescription>
                            '{getRowLabel(item)}' 항목을 삭제하시겠습니까? 이 작업은
                            되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(getId(item))}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            총 {total}건 중 {pageStart + 1}–{pageStart + pageItems.length}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `${title} 수정` : `새 ${title} 추가`}
            </DialogTitle>
            <DialogDescription>
              아래 필드를 입력한 후 저장하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {fields.map((field) => (
              <div
                key={field.name}
                className={`space-y-1.5 ${field.full ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={`field-${field.name}`}>
                  {field.label}
                  {field.required && (
                    <span className="text-destructive ml-0.5">*</span>
                  )}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`field-${field.name}`}
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(e) => setField(field.name, e.target.value)}
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={values[field.name] ?? ""}
                    onValueChange={(v) => setField(field.name, v)}
                  >
                    <SelectTrigger id={`field-${field.name}`}>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "image" ? (
                  <AdminImageField
                    id={`field-${field.name}`}
                    value={values[field.name] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(v) => setField(field.name, v)}
                  />
                ) : field.type === "readonly" ? (
                  <div
                    id={`field-${field.name}`}
                    className="min-h-9 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap break-words"
                  >
                    {values[field.name]?.trim()
                      ? values[field.name]
                      : "-"}
                  </div>
                ) : (
                  <Input
                    id={`field-${field.name}`}
                    type={field.type === "number" ? "number" : "text"}
                    value={values[field.name] ?? ""}
                    placeholder={
                      field.type === "tags"
                        ? field.placeholder ?? "쉼표(,)로 구분"
                        : field.placeholder
                    }
                    onChange={(e) => setField(field.name, e.target.value)}
                  />
                )}
                {field.type === "tags" && (
                  <p className="text-xs text-muted-foreground">
                    쉼표(,)로 여러 항목을 구분하세요.
                  </p>
                )}
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const toTags = (s: string): string[] =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

export const fromTags = (arr: string[] | undefined | null): string =>
  (arr ?? []).join(", ");

export const toNum = (s: string): number => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};
