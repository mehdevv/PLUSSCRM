import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSuperMode } from "@/hooks/useSuperMode";
import { canAccessRoute } from "@/lib/permissions";
import { getLoginPathForRoute } from "@/lib/constants";
import { isLoginRoute } from "@/components/auth/LoginForm";
import { useToast } from "@/hooks/use-toast";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, role, loading } = useAuth();
  const { isSuperMode } = useSuperMode();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const waitingForProfile = !!session && !profile;

  useEffect(() => {
    if (loading || waitingForProfile) return;
    if (!session) {
      const loginPath = getLoginPathForRoute(location);
      const redirect = !isLoginRoute(location) ? `?redirect=${encodeURIComponent(location)}` : "";
      setLocation(`${loginPath}${redirect}`);
      return;
    }
    if (!canAccessRoute(role, location, { superMode: isSuperMode })) {
      toast({ title: "Access denied", description: "You don't have permission to view this page.", variant: "destructive" });
      setLocation("/dashboard");
    }
  }, [loading, waitingForProfile, session, profile, role, isSuperMode, location, setLocation, toast]);

  if (loading || waitingForProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session || !profile) return null;
  if (!canAccessRoute(role, location, { superMode: isSuperMode })) return null;

  return <>{children}</>;
}
