import { useState, type ReactNode } from "react";
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
import { Plus, Pencil, Trash2, Inbox } from "lucide-react";

export type FormValues = Record<string, string>;

export type AdminField = {
  name: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "tags";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  full?: boolean;
};

export type AdminColumn<T> = {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
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
};

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
}: AdminSectionProps<T>) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            새 항목 추가
          </Button>
        )}
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">ID</TableHead>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.header}</TableHead>
              ))}
              <TableHead className="w-[120px] text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length + 2}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : !items || items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 2}
                  className="text-center py-12 text-muted-foreground"
                >
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  데이터가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
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
