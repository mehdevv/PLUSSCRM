import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { RoleRulesInfoButton } from "@/components/admin/RoleRulesCard";
import { CommissionEditModal } from "@/components/team/CommissionEditModal";
import { RepEditModal } from "@/components/team/RepEditModal";
import { Spinner } from "@/components/ui/spinner";
import { useSalesReps, useCompPlans, useRepCompensation, useCommissions, useTeamMutations, useLeaderboard } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { canDelete, canEdit, confirmDeleteMessage } from "@/lib/permissions";
import type { Profile, RepTier } from "@/types";
import { formatDate } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";
import type { Commission } from "@/types";
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2, X } from "lucide-react";

const TIER_LABELS: Record<RepTier, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  DIAMOND: "Diamond",
};

const TIER_STYLES: Record<RepTier, string> = {
  BRONZE: "bg-amber-50 text-amber-800 border-amber-300",
  SILVER: "bg-slate-50 text-slate-700 border-slate-300",
  GOLD: "bg-yellow-50 text-yellow-800 border-yellow-400",
  DIAMOND: "bg-blue-50 text-primary border-primary/40",
};

const PLAN_ACCENTS = ["#06B6D4", "#8B5CF6", "#1A1AFF", "#F59E0B", "#10B981"];

const tabs = ["Reps", "Compensation Plans", "Commission Ledger"];

const EMPTY_REP_FORM = { name: "", email: "", password: "", initials: "", color: "#8B5CF6" };

export default function Team() {
  const [activeTab, setActiveTab] = useState("Reps");
  const [showInvite, setShowInvite] = useState(false);
  const [repForm, setRepForm] = useState(EMPTY_REP_FORM);
  const [deletingRepId, setDeletingRepId] = useState<string | null>(null);
  const [editingRep, setEditingRep] = useState<Profile | null>(null);
  const [editingCommission, setEditingCommission] = useState<Commission | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: salesReps = [], isLoading: repsLoading } = useSalesReps();
  const { data: compPlans = [], isLoading: plansLoading } = useCompPlans();
  const { data: repCompensation = [], isLoading: repCompLoading } = useRepCompensation();
  const { data: commissions = [], isLoading: commissionsLoading } = useCommissions();
  const { data: leaderboard = [] } = useLeaderboard("monthly");
  const { updateProfile, payCommission, updateCommission, inviteRep, deleteRep, deleteCommission, setRepPlan } = useTeamMutations();
  const { formatMoney } = useCurrency();

  const statsMap = new Map(leaderboard.map((e) => [e.user_id, e]));
  const repPlanMap = new Map(repCompensation.map((rc) => [rc.user_id, rc]));
  const activeCount = salesReps.filter((r) => r.is_active).length;
  const savingRep = updateProfile.isPending || setRepPlan.isPending;

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateProfile.mutate({ id, updates: { is_active: !isActive } });
  };

  const handleDeleteRep = (rep: Profile) => {
    if (!canDelete("admin", "rep", { userId: user?.id, targetId: rep.id, targetRole: rep.role })) return;
    const ok = confirmDeleteMessage(
      rep.name,
      "Their open leads go back to the queue. Deals and clients move to you. Their login is removed permanently.",
    );
    if (!ok) return;
    setDeletingRepId(rep.id);
    deleteRep.mutate(rep.id, {
      onSuccess: () => toast({ title: "Rep deleted", description: `${rep.name} has been removed from the team.` }),
      onError: (err: Error) => toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      }),
      onSettled: () => setDeletingRepId(null),
    });
  };

  const handleSaveRep = async (updates: {
    name: string;
    initials: string;
    color: string;
    tier: Profile["tier"];
    vacation_mode: boolean;
    planId: string;
  }) => {
    if (!editingRep) return;
    try {
      await updateProfile.mutateAsync({
        id: editingRep.id,
        updates: {
          name: updates.name,
          initials: updates.initials,
          color: updates.color,
          tier: updates.tier,
          vacation_mode: updates.vacation_mode,
        },
      });
      const currentPlanId = repPlanMap.get(editingRep.id)?.plan_id;
      if (updates.planId && updates.planId !== currentPlanId) {
        await setRepPlan.mutateAsync({ userId: editingRep.id, planId: updates.planId });
      }
      setEditingRep(null);
      toast({ title: "Rep updated" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not save rep",
        variant: "destructive",
      });
    }
  };

  const handleRepPlanChange = (userId: string, planId: string) => {
    setRepPlan.mutate(
      { userId, planId },
      {
        onSuccess: () => toast({ title: "Commission plan updated" }),
        onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleSaveCommission = (updates: { rate: number; amount: number; status: "PAID" | "PENDING" }) => {
    if (!editingCommission) return;
    updateCommission.mutate(
      { id: editingCommission.id, updates },
      {
        onSuccess: () => { setEditingCommission(null); toast({ title: "Commission updated" }); },
        onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleDeleteCommission = (id: string, label: string) => {
    if (!confirmDeleteMessage(label, "This commission entry will be removed from the ledger.")) return;
    deleteCommission.mutate(id, {
      onSuccess: () => toast({ title: "Commission deleted" }),
      onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
    });
  };

  const handleInviteRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repForm.name.trim() || !repForm.email.trim() || !repForm.password) {
      toast({ title: "Missing fields", description: "Name, email, and password are required.", variant: "destructive" });
      return;
    }
    try {
      const email = repForm.email.trim();
      const result = await inviteRep.mutateAsync({
        name: repForm.name.trim(),
        email,
        password: repForm.password,
        initials: repForm.initials.trim() || undefined,
        color: repForm.color,
      });
      const defaultPlan =
        compPlans.find((p) => p.name === "Standard Plan") ?? compPlans[0];
      if (defaultPlan && result.userId) {
        await setRepPlan.mutateAsync({ userId: result.userId, planId: defaultPlan.id });
      }
      setRepForm(EMPTY_REP_FORM);
      setShowInvite(false);
      toast({
        title: "Rep created",
        description: `${email} can sign in at /login with the password you set.`,
      });
    } catch (err) {
      toast({
        title: "Failed to add rep",
        description: err instanceof Error ? err.message : "Could not create rep.",
        variant: "destructive",
      });
    }
  };

  const isLoading =
    (activeTab === "Reps" && repsLoading) ||
    (activeTab === "Compensation Plans" && (plansLoading || repCompLoading)) ||
    (activeTab === "Reps" && repCompLoading) ||
    (activeTab === "Commission Ledger" && commissionsLoading);

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Team</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {repsLoading ? "Loading…" : `${salesReps.length} reps · ${activeCount} active`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RoleRulesInfoButton />
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              data-testid="btn-add-rep"
            >
              <Plus className="w-4 h-4" />Add Rep
            </button>
          </div>
        </div>

        <div className="flex border-b border-border mb-5">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${tab.toLowerCase().replace(/\s/g, "-")}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : (
          <>
            {activeTab === "Reps" && (
              <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left" data-testid="team-table">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tier</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deals MTD</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Win Rate</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue MTD</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">Active</th>
                      <th className="px-4 py-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salesReps.map((rep) => {
                      const stats = statsMap.get(rep.id);
                      const winRate = stats?.win_rate ?? 0;
                      const dealsMtd = stats?.deals_mtd ?? 0;
                      const revenue = stats?.revenue ?? 0;
                      const repPlan = repPlanMap.get(rep.id);
                      return (
                        <tr key={rep.id} className="hover:bg-muted/40 transition-colors" data-testid={`rep-row-${rep.id}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: rep.color }}>
                                {rep.initials}
                              </div>
                              <div>
                                <div className="font-semibold text-foreground">{rep.name}</div>
                                <div className="text-xs text-muted-foreground">{rep.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIER_STYLES[rep.tier]}`}>
                              {TIER_LABELS[rep.tier]}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{dealsMtd}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${winRate}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{winRate}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{formatMoney(revenue)}</td>
                          <td className="px-4 py-3">
                            {compPlans.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <select
                                value={repPlan?.plan_id ?? ""}
                                onChange={(e) => handleRepPlanChange(rep.id, e.target.value)}
                                disabled={setRepPlan.isPending}
                                className="text-xs px-2 py-1.5 border border-border rounded-lg bg-background max-w-[140px]"
                                data-testid={`select-rep-plan-${rep.id}`}
                              >
                                {!repPlan && <option value="" disabled>Select plan</option>}
                                {compPlans.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.base_rate}%)</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggleActive(rep.id, rep.is_active)}
                              disabled={updateProfile.isPending}
                              className="flex items-center gap-1 mx-auto disabled:opacity-50"
                              title={rep.is_active ? "Deactivate login" : "Reactivate login"}
                              data-testid={`toggle-rep-${rep.id}`}
                            >
                              {rep.is_active ? (
                                <ToggleRight className="w-7 h-7 text-primary" />
                              ) : (
                                <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit("admin", "rep", { targetRole: rep.role }) && (
                                <button type="button" onClick={() => setEditingRep(rep)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" title="Edit rep" data-testid={`btn-edit-rep-${rep.id}`}>
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete("admin", "rep", { userId: user?.id, targetId: rep.id, targetRole: rep.role }) && (
                                <button type="button" onClick={() => handleDeleteRep(rep)} disabled={deletingRepId === rep.id || deleteRep.isPending} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50" title="Delete rep" data-testid={`btn-delete-rep-${rep.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "Compensation Plans" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {compPlans.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-full">No compensation plans configured.</p>
                ) : (
                  compPlans.map((plan, i) => {
                    const accent = PLAN_ACCENTS[i % PLAN_ACCENTS.length];
                    const rateLabel = plan.accelerator > 1
                      ? `${plan.base_rate}% + accelerator`
                      : `${plan.base_rate}%`;
                    return (
                      <div key={plan.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={`comp-plan-${plan.name.toLowerCase().replace(/\s/g, "-")}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
                          <span className="font-display text-xl font-bold" style={{ color: accent }}>{rateLabel}</span>
                        </div>
                        <h3 className="font-display font-bold text-base text-foreground mb-1">{plan.name}</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Tier multiplier: {plan.tier_multiplier}x
                          {plan.cap != null ? ` · Cap: ${formatMoney(plan.cap)}` : ""}
                        </p>
                        <div className="text-xs bg-muted rounded-lg px-3 py-2 text-muted-foreground mb-4">
                          Accelerator: {plan.accelerator}x at quota threshold
                        </div>
                        <div className="border-t border-border pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Assigned reps</p>
                          {salesReps.filter((r) => repPlanMap.get(r.id)?.plan_id === plan.id).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No reps on this plan</p>
                          ) : (
                            <ul className="space-y-1">
                              {salesReps
                                .filter((r) => repPlanMap.get(r.id)?.plan_id === plan.id)
                                .map((r) => (
                                  <li key={r.id} className="text-xs text-foreground flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: r.color }}>{r.initials}</span>
                                    {r.name}
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === "Commission Ledger" && (
              <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left" data-testid="commission-ledger-table">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rep</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rate</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid Date</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {commissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No commission records yet.</td>
                      </tr>
                    ) : (
                      commissions.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/40 transition-colors" data-testid={`commission-row-${c.id}`}>
                          <td className="px-4 py-3">
                            <span className="font-medium text-foreground">{c.rep_name}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{c.deal_label}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{c.rate}%</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{formatMoney(c.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              c.status === "PAID" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.paid_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => setEditingCommission(c)} className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10" title="Edit commission" data-testid={`btn-edit-commission-${c.id}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {c.status === "PENDING" && (
                                <button
                                  type="button"
                                  onClick={() => payCommission.mutate(c.id)}
                                  disabled={payCommission.isPending}
                                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                                  data-testid={`btn-pay-commission-${c.id}`}
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteCommission(c.id, `${c.rep_name} — ${c.deal_label}`)}
                                disabled={deleteCommission.isPending}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                title="Delete commission"
                                data-testid={`btn-delete-commission-${c.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <RepEditModal
        rep={editingRep}
        open={!!editingRep}
        saving={savingRep}
        compPlans={compPlans}
        currentPlanId={editingRep ? repPlanMap.get(editingRep.id)?.plan_id : undefined}
        onClose={() => setEditingRep(null)}
        onSave={handleSaveRep}
      />
      <CommissionEditModal commission={editingCommission} open={!!editingCommission} saving={updateCommission.isPending} onClose={() => setEditingCommission(null)} onSave={handleSaveCommission} />

      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-foreground">Add Sales Rep</h2>
              <button type="button" onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInviteRep} className="space-y-3">
              <input required placeholder="Full name" value={repForm.name} onChange={(e) => setRepForm({ ...repForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <input required type="email" placeholder="Email" value={repForm.email} onChange={(e) => setRepForm({ ...repForm, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <input required type="password" minLength={8} placeholder="Temporary password" value={repForm.password} onChange={(e) => setRepForm({ ...repForm, password: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <input placeholder="Initials (optional)" value={repForm.initials} onChange={(e) => setRepForm({ ...repForm, initials: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <button type="submit" disabled={inviteRep.isPending} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {inviteRep.isPending ? "Creating..." : "Create Rep Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
