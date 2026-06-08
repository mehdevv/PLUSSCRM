import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, BarChart3, Building2, Activity, CreditCard, Calculator, Settings, LogOut, ArrowUpRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Pipeline", href: "/pipeline", icon: BarChart3 },
  { name: "Clients", href: "/clients", icon: Building2 },
  { name: "Activities", href: "/activities", icon: Activity },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Accounting", href: "/accounting", icon: Calculator },
  { name: "Team", href: "/team", icon: Users },
  { name: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-card">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg">SalesCRM</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold font-display">
              SC
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-sm font-semibold truncate">Sarah Chen</div>
              <div className="text-xs text-muted-foreground">Admin</div>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background">
        {children}
      </div>
    </div>
  );
}
