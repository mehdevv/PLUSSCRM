import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useSplitRules, useSplitRuleMutations, useSalesReps } from "@/hooks/queries";
import type { SplitRule } from "@/types";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { confirmDeleteMessage } from "@/lib/permissions";
import { Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export default function SplitRules() {
  const [showForm, setShowForm] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [activateImmediately, setActivateImmediately] = useState(true);
  const [editingRule, setEditingRule] = useState<SplitRule | null>(null);

  const { toast } = useToast();
  const { data: rules = [], isLoading } = useSplitRules();
  const { data: salesReps = [] } = useSalesReps();
  const { toggle, create, update, remove } = useSplitRuleMutations();

  const activeReps = salesReps.filter((r) => r.is_active && r.role === "sales_rep");

  const handleToggle = (rule: SplitRule) => {
    toggle.mutate({ id: rule.id, active: !rule.is_active });
  };

  const handleDelete = (rule: SplitRule) => {
    if (!confirmDeleteMessage(rule.name, "This split rule will be removed. Leads stay in the system.")) return;
    remove.mutate(rule.id, {
      onSuccess: () => toast({ title: "Rule deleted" }),
      onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
    });
  };

  const resetForm = () => {
    setShowForm(false);
    setRuleName("");
    setSelectedReps([]);
    setActivateImmediately(true);
    setEditingRule(null);
  };

  const startEdit = (rule: SplitRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setSelectedReps(rule.rep_pool);
    setActivateImmediately(rule.is_active);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!ruleName.trim() || selectedReps.length === 0) return;
    const payload = {
      name: ruleName.trim(),
      mode: "ROUND_ROBIN" as const,
      rep_pool: selectedReps,
      is_active: activateImmediately,
    };
    if (editingRule) {
      update.mutate({ id: editingRule.id, updates: payload }, { onSuccess: resetForm });
      return;
    }
    create.mutate(payload, { onSuccess: resetForm });
  };

  const toggleRep = (repId: string) => {
    setSelectedReps((prev) =>
      prev.includes(repId) ? prev.filter((id) => id !== repId) : [...prev, repId],
    );
  };

  if (isLoading) {
    return (
      <Sidebar>
        <div className="p-6 min-h-full text-muted-foreground">Loading...</div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Split Rules</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Simple round-robin assignment — pick reps and turn a rule on or off
            </p>
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              data-testid="btn-create-rule"
            >
              <Plus className="w-4 h-4" />New Rule
            </button>
          )}
        </div>

        {showForm ? (
          <div className="max-w-lg bg-card border border-card-border rounded-xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-cyan-600" />
              </div>
              <div>
                <h2 className="font-display font-bold text-base text-foreground">
                  {editingRule ? "Edit Rule" : "New Rule"}
                </h2>
                <p className="text-xs text-muted-foreground">Leads rotate evenly across selected reps</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Rule name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Main team rotation"
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Reps in rotation</label>
                <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {activeReps.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No active sales reps</p>
                  ) : (
                    activeReps.map((rep) => (
                      <label key={rep.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedReps.includes(rep.id)}
                          onChange={() => toggleRep(rep.id)}
                          className="w-4 h-4 accent-primary rounded"
                        />
                        <span className="font-medium text-foreground">{rep.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={activateImmediately}
                  onChange={(e) => setActivateImmediately(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                  data-testid="checkbox-rule-active"
                />
                <span className="font-medium text-foreground">Active immediately</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={resetForm} className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!ruleName.trim() || selectedReps.length === 0 || create.isPending || update.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="btn-save-rule"
              >
                {create.isPending || update.isPending ? "Saving..." : editingRule ? "Update" : "Create Rule"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {rules.length === 0 && !showForm && (
            <div className="text-center py-16 text-muted-foreground bg-card border border-card-border rounded-xl">
              <p className="font-medium">No rules yet</p>
              <p className="text-sm mt-1">Create a simple round-robin rule or assign leads manually from the queue</p>
            </div>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="bg-card border border-card-border rounded-xl p-5 shadow-sm" data-testid={`rule-card-${rule.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-display font-bold text-base text-foreground">{rule.name}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        rule.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {rule.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Round-robin · {rule.rep_pool.length} reps · {rule.leads_assigned.toLocaleString()} leads assigned
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Created {formatDate(rule.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleToggle(rule)} data-testid={`toggle-rule-${rule.id}`}>
                    {rule.is_active ? <ToggleRight className="w-7 h-7 text-primary" /> : <ToggleLeft className="w-7 h-7 text-muted-foreground" />}
                  </button>
                  <button type="button" onClick={() => startEdit(rule)} className="text-xs text-primary font-medium hover:underline px-2" data-testid={`btn-edit-rule-${rule.id}`}>Edit</button>
                  <button type="button" onClick={() => handleDelete(rule)} disabled={remove.isPending} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50" title="Delete rule" data-testid={`btn-delete-rule-${rule.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Sidebar>
  );
}
