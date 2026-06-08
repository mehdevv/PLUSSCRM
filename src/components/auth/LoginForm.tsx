import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowUpRight, Eye, EyeOff, AlertCircle, Target, Trophy, Phone,
  LayoutDashboard, Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { validateLoginForm } from "@/lib/auth-errors";
import { REP_LOGIN_PATH, ADMIN_LOGIN_PATH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import type { UserRole } from "@/types";

const LEGACY_REMEMBER_KEYS = [
  "pluss_crm_remember_email",
  "pluss_crm_remember_email_v2",
  "pluss_crm_admin_remember_email",
  "pluss_crm_admin_remember_email_v2",
] as const;

const REP_FEATURES = [
  { icon: Target, text: "Track your leads and pipeline in real time" },
  { icon: Phone, text: "Log calls, emails, and meetings in one place" },
  { icon: Trophy, text: "Climb the leaderboard and earn tier rewards" },
];

const ADMIN_FEATURES = [
  { icon: LayoutDashboard, text: "Company-wide KPIs and team analytics" },
  { icon: Shield, text: "Lead routing, split rules, and assignment queue" },
  { icon: Target, text: "Accounting, commissions, and team management" },
];

function getRedirectPath(): string {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return "/dashboard";
}

interface LoginFormProps {
  portal: "rep" | "admin";
}

export function LoginForm({ portal }: LoginFormProps) {
  const requiredRole: UserRole = portal === "admin" ? "admin" : "sales_rep";
  const isAdmin = portal === "admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signOut, session, profile, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    for (const key of LEGACY_REMEMBER_KEYS) {
      localStorage.removeItem(key);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !session || !profile) return;
    if (profile.role !== requiredRole) return;
    setLocation(getRedirectPath());
  }, [authLoading, session, profile, requiredRole, setLocation]);

  const handleSignIn = async (signInEmail: string, signInPassword: string) => {
    setError(null);
    const validationError = validateLoginForm(signInEmail, signInPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const signedInProfile = await signIn(signInEmail, signInPassword);
      if (signedInProfile.role !== requiredRole) {
        await signOut();
        setError(
          isAdmin
            ? "Administrator credentials required. This portal is restricted to agency staff."
            : "This portal is for sales representatives only. Contact your administrator if you need access.",
        );
        return;
      }
      setLocation(getRedirectPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSignIn(email, password);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  if (session && profile && profile.role === requiredRole) return null;

  const features = isAdmin ? ADMIN_FEATURES : REP_FEATURES;
  const brandTitle = isAdmin ? "Staff Console" : "Sales Rep Portal";
  const headline = isAdmin
    ? "Agency administration"
    : "Close more deals, faster";
  const subline = isAdmin
    ? "Restricted access for PLUSS agency administrators."
    : "Sign in to manage your pipeline, log activities, and hit your targets.";
  const welcomeTitle = isAdmin ? "Administrator sign in" : "Welcome back";
  const welcomeSub = isAdmin
    ? "Enter your staff credentials to continue"
    : "Sign in with your rep account";

  return (
    <div className="min-h-screen flex">
      <div
        className={
          isAdmin
            ? "hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden bg-zinc-900 text-zinc-100 flex-col justify-between p-12"
            : "hidden lg:flex lg:w-[45%] xl:w-[42%] relative overflow-hidden bg-primary text-primary-foreground flex-col justify-between p-12"
        }
      >
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className={
                isAdmin
                  ? "w-11 h-11 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/15"
                  : "w-11 h-11 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20"
              }
            >
              {isAdmin ? <Shield className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
            </div>
            <div>
              <span className="font-display font-bold text-2xl tracking-tight">PLUSS CRM</span>
              <p className="text-xs opacity-60 mt-0.5">{brandTitle}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="font-display text-4xl xl:text-5xl font-bold leading-tight">{headline}</h1>
            <p className={`mt-4 text-lg max-w-md leading-relaxed ${isAdmin ? "text-zinc-400" : "text-primary-foreground/80"}`}>
              {subline}
            </p>
          </div>

          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className={`flex items-center gap-3 ${isAdmin ? "text-zinc-300" : "text-primary-foreground/90"}`}>
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className={`relative z-10 text-xs ${isAdmin ? "text-zinc-600" : "text-primary-foreground/50"}`}>
          © {new Date().getFullYear()} PLUSS Agency
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 bg-background">
        <div className="w-full max-w-md mx-auto">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div
              className={
                isAdmin
                  ? "w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center"
                  : "w-9 h-9 bg-primary rounded-lg flex items-center justify-center"
              }
            >
              {isAdmin ? (
                <Shield className="w-5 h-5 text-zinc-100" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
            <div>
              <span className="font-display font-bold text-xl">PLUSS CRM</span>
              <p className="text-[10px] text-muted-foreground">{brandTitle}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground">{welcomeTitle}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{welcomeSub}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor={`${portal}-email`}>Email address</Label>
              <Input
                id={`${portal}-email`}
                name={`${portal}-email`}
                type="email"
                autoComplete="off"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                disabled={loading}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${portal}-password`}>Password</Label>
              <div className="relative">
                <Input
                  id={`${portal}-password`}
                  name={`${portal}-password`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  disabled={loading}
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className={
                isAdmin
                  ? "w-full h-10 bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800"
                  : "w-full h-10"
              }
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner className={isAdmin ? "text-white" : "text-primary-foreground"} />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function isLoginRoute(path: string): boolean {
  return path === REP_LOGIN_PATH || path === ADMIN_LOGIN_PATH;
}
