import type { UserRole } from "@/types";

export const ROLE_GUIDE = {
  admin: {
    title: "Admin",
    summary: "Runs the business — assignment, imports, team, and accounting.",
    can: [
      "Import leads and manage the assignment queue",
      "View, edit, reassign, and delete any lead",
      "Create, edit, and delete split rules",
      "Add, edit, deactivate, or delete sales reps",
      "Edit commission entries and export accounting",
      "Change platform settings and currency",
    ],
    cannot: ["Use the rep sales board unless Staff Super Mode is enabled in Settings"],
  },
  sales_rep: {
    title: "Sales Rep",
    summary: "Works assigned leads through the sales process.",
    can: [
      "View, edit, and delete leads assigned to them",
      "Move deals through the pipeline and manage clients",
      "Log activities and appear on the leaderboard",
    ],
    cannot: [
      "Import leads, change split rules, or see other reps' leads",
      "Access team management, accounting, or all-leads admin views",
    ],
  },
} as const;

export type ManageResource =
  | "lead"
  | "rep"
  | "split_rule"
  | "deal"
  | "client"
  | "activity"
  | "payment"
  | "commission";

export function canEdit(
  role: UserRole | undefined,
  resource: ManageResource,
  context?: { userId?: string; assignedTo?: string | null; targetRole?: UserRole },
): boolean {
  if (!role) return false;
  if (role === "admin") {
    if (resource === "rep") return context?.targetRole === "sales_rep";
    return true;
  }
  if (role === "sales_rep" && resource === "lead") {
    return !!context?.userId && context.assignedTo === context.userId;
  }
  return false;
}

export function canDelete(
  role: UserRole | undefined,
  resource: ManageResource,
  context?: { userId?: string; assignedTo?: string | null; targetId?: string; targetRole?: UserRole },
): boolean {
  if (!role) return false;
  if (role === "admin") {
    if (resource === "rep") {
      if (!context?.userId || !context?.targetId) return false;
      if (context.userId === context.targetId) return false;
      return context.targetRole === "sales_rep";
    }
    return true;
  }
  if (role === "sales_rep" && resource === "lead") {
    return !!context?.userId && context.assignedTo === context.userId;
  }
  return false;
}

export function confirmDeleteMessage(name: string, detail: string): boolean {
  return window.confirm(`Delete ${name}?\n\n${detail}`);
}

export const PERMISSIONS = {
  leads: {
    viewAll: ["admin"] as UserRole[],
    import: ["admin"] as UserRole[],
    assign: ["admin"] as UserRole[],
    splitRules: ["admin"] as UserRole[],
    create: ["admin"] as UserRole[],
  },
  pipeline: { viewOwn: ["sales_rep"] as UserRole[] },
  accounting: { export: ["admin"] as UserRole[], view: ["admin"] as UserRole[] },
  team: { manage: ["admin"] as UserRole[], view: ["admin"] as UserRole[] },
  payments: {
    viewAll: ["admin"] as UserRole[],
    viewOwn: ["admin", "sales_rep"] as UserRole[],
    record: ["admin"] as UserRole[],
  },
  settings: {
    platform: ["admin"] as UserRole[],
    integrations: ["admin"] as UserRole[],
    profile: ["admin", "sales_rep"] as UserRole[],
    notifications: ["admin", "sales_rep"] as UserRole[],
  },
} as const;

export const ADMIN_ONLY_ROUTES = [
  "/leads/all",
  "/leads/import",
  "/leads/split-rules",
  "/leads/queue",
  "/accounting",
  "/team",
  "/assistant",
];

export const REP_ONLY_ROUTES = [
  "/leads",
  "/pipeline",
  "/clients",
  "/activities",
  "/leaderboard",
];

export type NavSection = "assignment" | "leads" | null;

export interface NavItem {
  name: string;
  href: string;
  roles: UserRole[];
  section?: NavSection;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", roles: ["admin", "sales_rep"] },
  { name: "Split Rules", href: "/leads/split-rules", roles: ["admin"], section: "assignment" },
  { name: "Queue", href: "/leads/queue", roles: ["admin"], section: "assignment" },
  { name: "All Leads", href: "/leads/all", roles: ["admin"], section: "leads" },
  { name: "Import Leads", href: "/leads/import", roles: ["admin"], section: "leads" },
  { name: "Leads", href: "/leads", roles: ["sales_rep"] },
  { name: "Pipeline", href: "/pipeline", roles: ["sales_rep"] },
  { name: "Clients", href: "/clients", roles: ["sales_rep"] },
  { name: "Activities", href: "/activities", roles: ["sales_rep"] },
  { name: "Payments", href: "/payments", roles: ["admin", "sales_rep"] },
  { name: "Accounting", href: "/accounting", roles: ["admin"] },
  { name: "Team", href: "/team", roles: ["admin"] },
  { name: "AI Assistant", href: "/assistant", roles: ["admin"] },
  { name: "Leaderboard", href: "/leaderboard", roles: ["sales_rep"] },
  { name: "Settings", href: "/settings", roles: ["admin", "sales_rep"] },
];

export const NAV_SECTION_LABELS: Record<Exclude<NavSection, null>, string> = {
  assignment: "Assignment",
  leads: "Leads",
};

export function hasPermission(role: UserRole | undefined, allowed: readonly UserRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

function isRepOnlyRoute(path: string): boolean {
  if (path === "/leads" || path === "/leads/") return true;
  return REP_ONLY_ROUTES.filter((r) => r !== "/leads").some(
    (r) => path === r || path.startsWith(`${r}/`),
  );
}

export function canAccessRoute(
  role: UserRole | undefined,
  path: string,
  options?: { superMode?: boolean },
): boolean {
  if (!role) return false;
  if (ADMIN_ONLY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`))) {
    return role === "admin";
  }
  if (isRepOnlyRoute(path)) {
    return role === "sales_rep" || (role === "admin" && !!options?.superMode);
  }
  return true;
}

export function getNavGroupsForRole(role: UserRole | undefined, superMode = false) {
  if (!role) return { main: [] as NavItem[], assignment: [] as NavItem[], leads: [] as NavItem[] };

  const roles: UserRole[] = role === "admin" && superMode ? ["admin", "sales_rep"] : [role];
  const visible = NAV_ITEMS.filter((item) => roles.some((r) => item.roles.includes(r)));
  const unique = visible.filter((item, i, arr) => arr.findIndex((x) => x.href === item.href) === i);

  return {
    main: unique.filter((item) => !item.section),
    assignment: unique.filter((item) => item.section === "assignment"),
    leads: unique.filter((item) => item.section === "leads"),
  };
}

export function canStaffOverride(superMode: boolean, role: UserRole | undefined): boolean {
  return superMode && role === "admin";
}

export function filterNavForRole(role: UserRole | undefined) {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
