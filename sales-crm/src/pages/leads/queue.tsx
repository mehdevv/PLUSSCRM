import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockLeads, salesReps } from "@/lib/mock-data";
import { AlertTriangle, Users, Check } from "lucide-react";

const unassigned = mockLeads.filter((l) => l.repId === null || l.status === "NEW").slice(0, 23);

export default function LeadsQueue() {
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedRep, setSelectedRep] = useState<number | null>(null);
  const [assigned, setAssigned] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selected.length === unassigned.length) setSelected([]);
    else setSelected(unassigned.map((l) => l.id));
  };

  const handleAssign = () => {
    if (!selectedRep || selected.length === 0) return;
    setAssigned((prev) => [...prev, ...selected]);
    setSelected([]);
    setSelectedRep(null);
  };

  const remaining = unassigned.filter((l) => !assigned.includes(l.id));

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Assignment Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Leads not matched by any active split rule</p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800 text-sm">{remaining.length} leads are waiting in the overflow queue.</div>
            <div className="text-xs text-amber-700 mt-0.5">These leads did not match any active assignment rules. Assign them manually or activate a split rule.</div>
          </div>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">{selected.length} leads selected</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <select
                value={selectedRep || ""}
                onChange={(e) => setSelectedRep(Number(e.target.value))}
                className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="select-assign-rep"
              >
                <option value="">Select rep...</option>
                {salesReps.filter((r) => r.active && r.role !== "Admin").map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({r.activeLeads} active)</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedRep}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="btn-assign-selected"
              >
                <Users className="w-4 h-4" />Assign {selected.length} Lead{selected.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left" data-testid="queue-table">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.length === remaining.length && remaining.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                    data-testid="checkbox-select-all"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Country</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {remaining.map((lead) => (
                <tr
                  key={lead.id}
                  className={`hover:bg-muted/40 transition-colors ${selected.includes(lead.id) ? "bg-primary/5" : ""}`}
                  data-testid={`queue-row-${lead.id}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                      data-testid={`checkbox-lead-${lead.id}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-display font-bold text-foreground text-sm">{lead.name}</div>
                    <div className="text-xs text-muted-foreground">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{lead.company}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">{lead.source}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">${lead.value.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{lead.country}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">NEW</span>
                  </td>
                </tr>
              ))}
              {remaining.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <div className="font-medium">All leads have been assigned</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Sidebar>
  );
}
