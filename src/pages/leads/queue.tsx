import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { LeadEditModal, type LeadFormValues } from "@/components/leads/LeadEditModal";
import { useQueueLeads, useSalesReps, useLeadMutations } from "@/hooks/queries";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/use-toast";
import { leadFormToUpdates } from "@/lib/lead-form";
import { confirmDeleteMessage } from "@/lib/permissions";
import { STATUS_LABELS } from "@/lib/constants";
import {
  type LinkFilter,
  matchesLeadSearch,
  matchesLinkFilter,
} from "@/lib/lead-filters";
import type { Lead } from "@/types";
import {
  AlertTriangle, Users, Check, Plus, X, Pencil, Trash2,
  Search, Filter, ListChecks,
} from "lucide-react";

const EMPTY_LEAD_FORM = { first_name: "", last_name: "", email: "", company: "", phone: "", source: "", value: "" };

type SortKey = "created_at" | "name" | "company" | "value" | "source" | "wilaya";

export default function LeadsQueue() {
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedRep, setSelectedRep] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_LEAD_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [wilayaFilter, setWilayaFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("ALL");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [firstN, setFirstN] = useState("");

  const { data: queueLeads = [], isLoading, isError } = useQueueLeads();
  const { data: salesReps = [] } = useSalesReps();
  const { bulkAssign, create, update, remove } = useLeadMutations();
  const { formatMoney } = useCurrency();
  const { toast } = useToast();

  const activeReps = salesReps.filter((r) => r.is_active && r.role === "sales_rep");

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of queueLeads) if (l.source?.trim()) set.add(l.source.trim());
    return [...set].sort();
  }, [queueLeads]);

  const wilayaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const l of queueLeads) {
      const w = l.wilaya?.trim() || l.country?.trim();
      if (w) set.add(w);
    }
    return [...set].sort();
  }, [queueLeads]);

  const filteredLeads = useMemo(() => {
    const min = minValue !== "" ? Number(minValue) : null;
    const max = maxValue !== "" ? Number(maxValue) : null;
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    const list = queueLeads.filter((lead) => {
      if (!matchesLeadSearch(lead, search)) return false;
      if (sourceFilter !== "ALL" && (lead.source ?? "") !== sourceFilter) return false;
      if (wilayaFilter !== "ALL") {
        const region = lead.wilaya?.trim() || lead.country?.trim() || "";
        if (region !== wilayaFilter) return false;
      }
      if (statusFilter !== "ALL" && lead.status !== statusFilter) return false;
      if (!matchesLinkFilter(lead, linkFilter)) return false;
      if (min != null && !Number.isNaN(min) && lead.value < min) return false;
      if (max != null && !Number.isNaN(max) && lead.value > max) return false;
      if (fromTs != null && new Date(lead.created_at).getTime() < fromTs) return false;
      if (toTs != null && new Date(lead.created_at).getTime() > toTs) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "company":
          return a.company.localeCompare(b.company) * dir;
        case "value":
          return (a.value - b.value) * dir;
        case "source":
          return (a.source ?? "").localeCompare(b.source ?? "") * dir;
        case "wilaya": {
          const aw = a.wilaya ?? a.country ?? "";
          const bw = b.wilaya ?? b.country ?? "";
          return aw.localeCompare(bw) * dir;
        }
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
    });
  }, [
    queueLeads, search, sourceFilter, wilayaFilter, statusFilter, linkFilter,
    minValue, maxValue, dateFrom, dateTo, sortBy, sortDir,
  ]);

  const filteredIds = useMemo(() => new Set(filteredLeads.map((l) => l.id)), [filteredLeads]);
  const visibleSelectedCount = selected.filter((id) => filteredIds.has(id)).length;
  const allFilteredSelected = filteredLeads.length > 0 && visibleSelectedCount === filteredLeads.length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const selectFiltered = () => {
    setSelected(filteredLeads.map((l) => l.id));
  };

  const clearSelection = () => setSelected([]);

  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      setSelected((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      setSelected((prev) => [...new Set([...prev, ...filteredLeads.map((l) => l.id)])]);
    }
  };

  const selectRowRange = () => {
    const from = Math.max(1, parseInt(rangeFrom, 10) || 0);
    const to = Math.max(from, parseInt(rangeTo, 10) || from);
    if (!from || !to) {
      toast({ title: "Invalid range", description: "Enter row numbers (e.g. 1 to 50).", variant: "destructive" });
      return;
    }
    const ids = filteredLeads.slice(from - 1, to).map((l) => l.id);
    if (ids.length === 0) {
      toast({ title: "No leads in range", description: "Adjust filters or row numbers.", variant: "destructive" });
      return;
    }
    setSelected((prev) => [...new Set([...prev, ...ids])]);
    toast({ title: "Range selected", description: `Selected rows ${from}–${to} (${ids.length} leads).` });
  };

  const selectFirstN = () => {
    const n = parseInt(firstN, 10);
    if (!n || n < 1) {
      toast({ title: "Invalid count", description: "Enter how many leads to select.", variant: "destructive" });
      return;
    }
    const ids = filteredLeads.slice(0, n).map((l) => l.id);
    setSelected((prev) => [...new Set([...prev, ...ids])]);
    toast({ title: "Leads selected", description: `Selected first ${ids.length} filtered lead(s).` });
  };

  const clearFilters = () => {
    setSearch("");
    setSourceFilter("ALL");
    setWilayaFilter("ALL");
    setStatusFilter("ALL");
    setLinkFilter("ALL");
    setMinValue("");
    setMaxValue("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    search || sourceFilter !== "ALL" || wilayaFilter !== "ALL" || statusFilter !== "ALL"
    || linkFilter !== "ALL" || minValue || maxValue || dateFrom || dateTo;

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      toast({ title: "Missing fields", description: "First name, last name, and email are required.", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source.trim() || undefined,
        value: form.value ? Number(form.value) : undefined,
      });
      setForm(EMPTY_LEAD_FORM);
      setShowCreate(false);
      toast({ title: "Lead created", description: "The lead has been added to the queue." });
    } catch (err) {
      toast({ title: "Failed to create lead", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleDelete = (lead: Lead) => {
    const label = lead.company ? `${lead.name} (${lead.company})` : lead.name;
    if (!confirmDeleteMessage(label, "This lead will be removed from the system.")) return;
    setDeletingId(lead.id);
    remove.mutate(lead.id, {
      onSuccess: () => {
        setSelected((prev) => prev.filter((id) => id !== lead.id));
        toast({ title: "Lead deleted", description: `${lead.name} has been removed.` });
      },
      onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      onSettled: () => setDeletingId(null),
    });
  };

  const handleSaveLead = (values: LeadFormValues) => {
    if (!editingLead) return;
    update.mutate(
      { id: editingLead.id, updates: leadFormToUpdates(values, true) },
      {
        onSuccess: () => { setEditingLead(null); toast({ title: "Lead updated" }); },
        onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleAssign = async () => {
    if (!selectedRep || selected.length === 0) return;
    try {
      const count = selected.length;
      await bulkAssign.mutateAsync({ leadIds: selected, repId: selectedRep });
      setSelected([]);
      setSelectedRep("");
      toast({ title: "Leads assigned", description: `${count} lead(s) assigned successfully.` });
    } catch (err) {
      toast({
        title: "Assignment failed",
        description: err instanceof Error ? err.message : "Could not assign leads.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Assignment Queue</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Filter, search, and pick exact leads to assign to your reps
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            data-testid="btn-new-lead"
          >
            <Plus className="w-4 h-4" />New Lead
          </button>
        </div>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800 text-sm">
              {isLoading ? "—" : `${filteredLeads.length} of ${queueLeads.length}`} leads shown in queue
            </div>
            <div className="text-xs text-amber-700 mt-0.5">
              Use filters below to narrow down, then select by row range or individually before assigning.
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-4 mb-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="w-4 h-4 text-muted-foreground" />
            Find leads
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search name, company, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="queue-search"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="ALL">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={wilayaFilter}
              onChange={(e) => setWilayaFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="ALL">All wilayas</option>
              {wilayaOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="ALL">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value as LinkFilter)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="ALL">All links</option>
              <option value="GOOGLE_MAPS">Has Google Maps</option>
              <option value="WEBSITE">Has website</option>
              <option value="BOTH">Has both links</option>
              <option value="ANY">Has any link</option>
              <option value="NONE">No links</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Value $</span>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="w-24 px-2 py-2 border border-border rounded-lg bg-background text-sm"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className="w-24 px-2 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Created</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-2 border border-border rounded-lg bg-background text-sm"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-2 border border-border rounded-lg bg-background text-sm"
              />
            </div>
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
                setSortBy(key);
                setSortDir(dir);
              }}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            >
              <option value="created_at:asc">Oldest first</option>
              <option value="created_at:desc">Newest first</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="company:asc">Company A–Z</option>
              <option value="value:desc">Highest value</option>
              <option value="value:asc">Lowest value</option>
              <option value="wilaya:asc">Wilaya A–Z</option>
              <option value="source:asc">Source A–Z</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-muted/50 border border-border rounded-xl p-3 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ListChecks className="w-4 h-4 text-muted-foreground" />
            Selection
            <span className="text-xs font-normal text-muted-foreground">
              ({selected.length} total{visibleSelectedCount !== selected.length ? `, ${visibleSelectedCount} visible` : ""})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectFiltered}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-background hover:bg-muted"
            >
              Select all filtered ({filteredLeads.length})
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selected.length === 0}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-50"
            >
              Clear selection
            </button>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Rows</span>
              <input
                type="number"
                min="1"
                placeholder="From"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                className="w-16 px-2 py-1.5 border border-border rounded-lg bg-background text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="number"
                min="1"
                placeholder="To"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                className="w-16 px-2 py-1.5 border border-border rounded-lg bg-background text-sm"
              />
              <button
                type="button"
                onClick={selectRowRange}
                className="px-2 py-1.5 text-xs font-medium border border-primary/30 text-primary rounded-lg bg-primary/5 hover:bg-primary/10"
              >
                Select range
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">First</span>
              <input
                type="number"
                min="1"
                placeholder="N"
                value={firstN}
                onChange={(e) => setFirstN(e.target.value)}
                className="w-16 px-2 py-1.5 border border-border rounded-lg bg-background text-sm"
              />
              <button
                type="button"
                onClick={selectFirstN}
                className="px-2 py-1.5 text-xs font-medium border border-primary/30 text-primary rounded-lg bg-primary/5 hover:bg-primary/10"
              >
                Select
              </button>
            </div>
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
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="select-assign-rep"
              >
                <option value="">Select rep...</option>
                {activeReps.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssign}
                disabled={!selectedRep || bulkAssign.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                data-testid="btn-assign-selected"
              >
                <Users className="w-4 h-4" />
                {bulkAssign.isPending ? "Assigning..." : `Assign ${selected.length} Lead${selected.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-sm text-red-500">Failed to load assignment queue.</div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left" data-testid="queue-table">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAllFiltered}
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="px-2 py-3 w-10 text-xs font-semibold text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lead</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Company</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Value</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wilaya</th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.map((lead, index) => (
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
                    <td className="px-2 py-3 text-xs text-muted-foreground tabular-nums">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-display font-bold text-foreground text-sm">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">{lead.company}</td>
                    <td className="px-4 py-3">
                      {lead.source ? (
                        <span className="text-xs bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">{lead.source}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatMoney(lead.value, "USD")}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{lead.wilaya ?? lead.country ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{lead.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setEditingLead(lead)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" title="Edit lead" data-testid={`btn-edit-lead-${lead.id}`}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(lead)} disabled={deletingId === lead.id || remove.isPending} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50" title="Delete lead" data-testid={`btn-delete-lead-${lead.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      {queueLeads.length === 0 ? (
                        <>
                          <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                          <div className="font-medium">All leads have been assigned</div>
                        </>
                      ) : (
                        <div className="font-medium">No leads match your filters</div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LeadEditModal lead={editingLead} open={!!editingLead} isAdmin saving={update.isPending} onClose={() => setEditingLead(null)} onSave={handleSaveLead} />

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold">New Lead</h2>
              <button type="button" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreateLead} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
                <input required placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              </div>
              <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <input type="number" min="0" placeholder="Deal value (USD)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />
              <button type="submit" disabled={create.isPending} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {create.isPending ? "Creating..." : "Create Lead"}
              </button>
            </form>
          </div>
        </div>
      )}
    </Sidebar>
  );
}
