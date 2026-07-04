import {
  Factory,
  Activity,
  Network,
  Server,
  Users,
  LayoutDashboard,
  Building2,
  Package,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden by default unless an admin override in nav_settings says otherwise. */
  defaultHidden?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "news", href: "/news", label: "최근 소식", icon: Newspaper },
  { key: "dashboard", href: "/", label: "대시보드", icon: LayoutDashboard },
  { key: "companies", href: "/companies", label: "공급사 디렉토리", icon: Factory },
  {
    key: "client-companies",
    href: "/client-companies",
    label: "고객사 디렉토리",
    icon: Building2,
  },
  { key: "offers", href: "/offers", label: "오퍼 리스트", icon: Package },
  { key: "projects", href: "/projects", label: "프로젝트 의뢰", icon: Activity },
  {
    key: "matches",
    href: "/matches",
    label: "매칭 보드",
    icon: Network,
    defaultHidden: true,
  },
  {
    key: "solutions",
    href: "/solutions",
    label: "솔루션 갤러리",
    icon: Server,
    defaultHidden: true,
  },
  { key: "talent", href: "/talent", label: "인력 Pool", icon: Users },
];

/**
 * Given the nav visibility overrides from the API (key -> hidden), returns
 * whether a nav item should be hidden. An explicit override wins; otherwise the
 * item's `defaultHidden` applies.
 */
export function isNavItemHidden(
  item: NavItem,
  overrides: Record<string, boolean>,
): boolean {
  if (item.key in overrides) return overrides[item.key];
  return item.defaultHidden ?? false;
}
