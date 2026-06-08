import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import type { Profile } from "@/types";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "pluss_super_mode";

interface StoredSuperMode {
  repId: string;
  repName: string;
}

interface SuperModeContextValue {
  superModeRep: Profile | null;
  isSuperMode: boolean;
  activating: boolean;
  activate: (rep: Profile, adminPassword: string) => Promise<void>;
  deactivate: () => void;
}

export const SuperModeContext = createContext<SuperModeContextValue | null>(null);

function readStored(): StoredSuperMode | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSuperMode;
  } catch {
    return null;
  }
}

export function SuperModeProvider({ children }: { children: ReactNode }) {
  const { isAdmin, user } = useAuth();
  const [stored, setStored] = useState<StoredSuperMode | null>(() => readStored());
  const [superModeRep, setSuperModeRep] = useState<Profile | null>(null);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setStored(null);
      setSuperModeRep(null);
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    const s = readStored();
    setStored(s);
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !stored?.repId) {
      setSuperModeRep(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", stored.repId)
        .eq("role", "sales_rep")
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        sessionStorage.removeItem(STORAGE_KEY);
        setStored(null);
        setSuperModeRep(null);
        return;
      }
      setSuperModeRep({
        id: data.id as string,
        name: data.name as string,
        email: data.email as string,
        role: "sales_rep",
        avatar_url: (data.avatar_url as string) ?? null,
        initials: data.initials as string,
        tier: data.tier as Profile["tier"],
        points: data.points as number,
        is_active: data.is_active as boolean,
        vacation_mode: data.vacation_mode as boolean,
        color: data.color as string,
        created_at: data.created_at as string,
      });
    })();
    return () => { cancelled = true; };
  }, [isAdmin, stored?.repId]);

  const activate = useCallback(async (rep: Profile, adminPassword: string) => {
    if (!isAdmin || !user?.email) throw new Error("Admin session required");
    setActivating(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: adminPassword,
      });
      if (error) throw new Error(mapAuthError(error.message));

      const payload: StoredSuperMode = { repId: rep.id, repName: rep.name };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStored(payload);
      setSuperModeRep(rep);
    } finally {
      setActivating(false);
    }
  }, [isAdmin, user?.email]);

  const deactivate = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStored(null);
    setSuperModeRep(null);
  }, []);

  const value = useMemo<SuperModeContextValue>(
    () => ({
      superModeRep,
      isSuperMode: isAdmin && !!superModeRep,
      activating,
      activate,
      deactivate,
    }),
    [superModeRep, isAdmin, activating, activate, deactivate],
  );

  return <SuperModeContext.Provider value={value}>{children}</SuperModeContext.Provider>;
}
