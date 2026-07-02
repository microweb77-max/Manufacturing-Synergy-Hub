import { Factory, Monitor, Wrench, type LucideIcon } from "lucide-react";

export type CompanyType = "hardware" | "software" | "service";

export type CompanyTypeMeta = {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for a Badge background/text. */
  badgeClass: string;
  /** Tailwind class for a standalone icon color. */
  iconColor: string;
};

export const COMPANY_TYPE_META: Record<CompanyType, CompanyTypeMeta> = {
  hardware: {
    label: "하드웨어",
    icon: Factory,
    badgeClass: "bg-amber-500/10 text-amber-600",
    iconColor: "text-amber-500",
  },
  software: {
    label: "소프트웨어",
    icon: Monitor,
    badgeClass: "bg-blue-500/10 text-blue-600",
    iconColor: "text-blue-500",
  },
  service: {
    label: "서비스",
    icon: Wrench,
    badgeClass: "bg-teal-500/10 text-teal-600",
    iconColor: "text-teal-500",
  },
};

export function getCompanyTypeMeta(type: string | null | undefined): CompanyTypeMeta {
  return COMPANY_TYPE_META[(type ?? "hardware") as CompanyType] ?? COMPANY_TYPE_META.hardware;
}

export const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: "hardware", label: "하드웨어" },
  { value: "software", label: "소프트웨어" },
  { value: "service", label: "서비스" },
];
