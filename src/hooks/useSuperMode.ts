import { useContext } from "react";
import { SuperModeContext } from "@/contexts/SuperModeContext";
import { useAuth } from "@/hooks/useAuth";

export function useSuperMode() {
  const ctx = useContext(SuperModeContext);
  if (!ctx) throw new Error("useSuperMode must be used within SuperModeProvider");
  return ctx;
}

/** Effective rep context for Leads / Pipeline / Clients pages. */
export function useStaffView() {
  const { user, isAdmin, role } = useAuth();
  const { superModeRep, isSuperMode } = useSuperMode();

  const effectiveRepId = isSuperMode ? superModeRep?.id : user?.id;
  const canStaffOverride = isSuperMode;

  return {
    effectiveRepId,
    effectiveRep: isSuperMode ? superModeRep : null,
    isSuperMode,
    canStaffOverride,
    isAdmin,
    role,
    userId: user?.id,
  };
}
