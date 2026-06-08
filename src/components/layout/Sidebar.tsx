import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart3, Building2, Activity, CreditCard,
  Calculator, Settings,   LogOut, ArrowUpRight, Trophy, GitBranch, Inbox,
  Upload, List, Bot, PanelLeftClose, PanelLeft, ShieldAlert, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSuperMode } from "@/hooks/useSuperMode";
import { getNavGroupsForRole, NAV_SECTION_LABELS, type NavItem } from "@/lib/permissions";
import { getLogoutPath } from "@/lib/constants";
import { AdminChatbot } from "@/components/admin/AdminChatbot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_COLLAPSED_KEY = "pluss-sidebar-collapsed";

const ICONS: Record<string, typeof LayoutDashboard> = {
  Dashboard: LayoutDashboard,
  Leads: Users,
  "All Leads": List,
  "Import Leads": Upload,
  "Split Rules": GitBranch,
  Queue: Inbox,
  Pipeline: BarChart3,
  Clients: Building2,
  Activities: Activity,
  Payments: CreditCard,
  Accounting: Calculator,
  Team: Users,
  Leaderboard: Trophy,
  Settings: Settings,
  "AI Assistant": Bot,
};

function NavLink({
  item,
  location,
  collapsed,
}: {
  item: NavItem;
  location: string;
  collapsed: boolean;
}) {
  const Icon = ICONS[item.name] ?? LayoutDashboard;
  const isActive = location === item.href || location.startsWith(`${item.href}/`);

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center rounded-md text-sm font-medium transition-colors",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.name}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.name}
      </TooltipContent>
    </Tooltip>
  );
}

function NavSection({
  label,
  items,
  location,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  location: string;
  collapsed: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className={cn("pt-3 pb-1", collapsed && "pt-2")}>
      {!collapsed && (
        <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {label}
        </div>
      )}
      {collapsed && <div className="mx-auto mb-2 w-6 border-t border-border" />}
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink key={item.href} item={item} location={location} collapsed={collapsed} />
        ))}
      </div>
    </div>
  );
}

const REP_WORK_HREFS = ["/leads", "/pipeline", "/clients", "/activities", "/leaderboard"];

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, role, signOut, isAdmin } = useAuth();
  const { isSuperMode, superModeRep, deactivate } = useSuperMode();
  const { main, assignment, leads } = getNavGroupsForRole(role, isSuperMode);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    const logoutPath = getLogoutPath(role);
    await signOut();
    window.location.href = logoutPath;
  };

  const dashboardItem = main.find((i) => i.href === "/dashboard");
  const otherMain = main.filter((i) => i.href !== "/dashboard");
  const repWork = otherMain.filter((i) => REP_WORK_HREFS.includes(i.href));
  const adminMain = otherMain.filter((i) => !REP_WORK_HREFS.includes(i.href));

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        "flex items-center text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors",
        collapsed ? "justify-center p-2.5 w-full" : "justify-center gap-2 w-full px-3 py-2",
      )}
    >
      <LogOut className="w-4 h-4 shrink-0" />
      {!collapsed && "Logout"}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card shrink-0 transition-[width] duration-200 ease-in-out",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div
          className={cn(
            "h-16 flex items-center border-b border-border shrink-0",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          <div className={cn("flex items-center gap-2 min-w-0", collapsed && "justify-center")}>
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="font-display font-bold text-lg truncate">PLUSS CRM</span>
            )}
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-border">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-4", collapsed ? "px-2" : "px-3")}>
          {dashboardItem && (
            <div className="space-y-0.5 mb-1">
              <NavLink item={dashboardItem} location={location} collapsed={collapsed} />
            </div>
          )}

          {isAdmin && (
            <>
              <NavSection label={NAV_SECTION_LABELS.assignment} items={assignment} location={location} collapsed={collapsed} />
              <NavSection label={NAV_SECTION_LABELS.leads} items={leads} location={location} collapsed={collapsed} />
            </>
          )}

          {isSuperMode && repWork.length > 0 && (
            <NavSection label="Staff view" items={repWork} location={location} collapsed={collapsed} />
          )}

          {!isSuperMode && repWork.length > 0 && (
            <div className="space-y-0.5">
              {repWork.map((item) => (
                <NavLink key={item.href} item={item} location={location} collapsed={collapsed} />
              ))}
            </div>
          )}

          {adminMain.length > 0 && (
            <div className={cn("space-y-0.5", (isAdmin || isSuperMode) && !collapsed && "pt-3 border-t border-border mt-2", (isAdmin || isSuperMode) && collapsed && "pt-2 mt-1")}>
              {(isAdmin || isSuperMode) && collapsed && <div className="mx-auto mb-2 w-6 border-t border-border" />}
              {adminMain.map((item) => (
                <NavLink key={item.href} item={item} location={location} collapsed={collapsed} />
              ))}
            </div>
          )}
        </nav>

        <div className={cn("border-t border-border shrink-0", collapsed ? "p-2" : "p-4")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold font-display text-white text-xs cursor-default"
                    style={{ backgroundColor: profile?.color ?? "#1A1AFF" }}
                  >
                    {profile?.initials ?? "?"}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{profile?.name ?? "User"}</p>
                  <p className="text-primary-foreground/80">{isAdmin ? "Admin" : "Sales Rep"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Logout</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold font-display text-white text-sm shrink-0"
                  style={{ backgroundColor: profile?.color ?? "#1A1AFF" }}
                >
                  {profile?.initials ?? "?"}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm font-semibold truncate">{profile?.name ?? "User"}</div>
                  <div className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Sales Rep"}</div>
                </div>
              </div>
              {logoutButton}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background min-w-0 flex flex-col min-h-0">
        {isSuperMode && superModeRep && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-amber-900 dark:text-amber-100 truncate">
                <strong>Super mode</strong> — managing <strong>{superModeRep.name}</strong>&apos;s leads &amp; pipeline
              </span>
            </div>
            <button
              type="button"
              onClick={deactivate}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border border-amber-500/40 text-amber-800 hover:bg-amber-500/15"
            >
              <X className="w-3.5 h-3.5" /> Exit
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </div>
      {isAdmin && <AdminChatbot />}
    </div>
  );
}
