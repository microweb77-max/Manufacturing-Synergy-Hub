import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
if (!clerkPubKey) throw new Error("Clerk publishable key is not configured.");

export function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/auth-logo.svg`,
  },
  variables: {
    colorPrimary: "#2563eb",
    colorForeground: "#0f172a",
    colorMutedForeground: "#64748b",
    colorBackground: "#ffffff",
    fontFamily: "Pretendard, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
  },
};