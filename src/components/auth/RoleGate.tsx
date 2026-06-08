import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";
import { hasPermission } from "@/lib/permissions";

interface RoleGateProps {
  allowed: readonly UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ allowed, children, fallback = null }: RoleGateProps) {
  const { role } = useAuth();
  if (!hasPermission(role, allowed)) return <>{fallback}</>;
  return <>{children}</>;
}
