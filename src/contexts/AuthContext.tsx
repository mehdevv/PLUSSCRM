import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { mapAuthError } from "@/lib/auth-errors";
import type { Profile, UserRole } from "@/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | undefined;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Profile>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as UserRole,
    avatar_url: (row.avatar_url as string) ?? null,
    initials: row.initials as string,
    tier: row.tier as Profile["tier"],
    points: row.points as number,
    is_active: row.is_active as boolean,
    vacation_mode: row.vacation_mode as boolean,
    color: row.color as string,
    created_at: row.created_at as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [resolvingProfile, setResolvingProfile] = useState(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("[auth] profile fetch failed:", error.message);
      return null;
    }
    if (!data) return null;

    const mapped = mapProfile(data as Record<string, unknown>);
    setProfile(mapped);
    return mapped;
  }, []);

  const resolveProfile = useCallback(async (userId: string) => {
    setResolvingProfile(true);
    try {
      await fetchProfile(userId);
    } finally {
      setResolvingProfile(false);
    }
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  }, [session?.user?.id, fetchProfile]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!active) return;
      setSession(s);
      if (s?.user?.id) {
        await resolveProfile(s.user.id);
      }
      if (active) setInitializing(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s?.user?.id) {
        setProfile(null);
        return;
      }
      // Defer Supabase calls — async work inside this listener can deadlock auth.
      setTimeout(() => {
        if (active) void resolveProfile(s.user!.id);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));

    if (!data.session || !data.user?.id) {
      throw new Error("Sign in failed. Please try again.");
    }

    setSession(data.session);

    let profileRow: Record<string, unknown> | null = null;
    const { data: existing, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (existing) {
      profileRow = existing as Record<string, unknown>;
    } else if (profileError) {
      await supabase.auth.signOut();
      setSession(null);
      throw new Error("Could not load your profile. Try again or contact your admin.");
    }

    if (!profileRow) {
      const meta = data.user.user_metadata ?? {};
      const role = meta.role === "admin" ? "admin" : "sales_rep";
      const name = (meta.name as string) || trimmedEmail.split("@")[0];
      const repair = {
        id: data.user.id,
        email: trimmedEmail,
        name,
        initials: name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
        role,
        tier: "BRONZE",
        points: 0,
        is_active: true,
        vacation_mode: false,
        color: "#8B5CF6",
      };
      const { data: repaired, error: repairError } = await supabase
        .from("profiles")
        .upsert(repair, { onConflict: "id" })
        .select()
        .maybeSingle();
      if (repairError || !repaired) {
        await supabase.auth.signOut();
        setSession(null);
        throw new Error("Account profile not found. Ask your admin to re-save your rep account.");
      }
      profileRow = repaired as Record<string, unknown>;
    }

    const mapped = mapProfile(profileRow);
    if (!mapped.is_active) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      throw new Error("Your account has been deactivated. Contact your administrator.");
    }

    setProfile(mapped);
    return mapped;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  }, []);

  const loading = initializing || resolvingProfile;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role,
      isAdmin: profile?.role === "admin",
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
