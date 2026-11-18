import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useAuth, useClerk } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentSession } from "@workspace/api-client-react";

interface AdminAuthContextValue {
  isAdmin: boolean;
  isLoaded: boolean;
  error: boolean;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  const session = useGetCurrentSession({
    query: {
      queryKey: ["verified-session", userId ?? null],
      enabled: isLoaded && !!isSignedIn,
      staleTime: 0,
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    },
  });
  useEffect(() => {
    if (previousUser.current !== undefined && previousUser.current !== (userId ?? null)) {
      queryClient.clear();
    }
    previousUser.current = userId ?? null;
  }, [userId, queryClient]);
  const isAdmin = !!isSignedIn && !session.isError &&
    session.data?.userId === userId && session.data?.isAdmin === true;
  const logout = () => { void signOut({ redirectUrl: import.meta.env.BASE_URL }); };

  return (
    <AdminAuthContext.Provider value={{
      isAdmin,
      isLoaded: isLoaded && (!isSignedIn || !session.isPending),
      error: session.isError,
      logout,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
