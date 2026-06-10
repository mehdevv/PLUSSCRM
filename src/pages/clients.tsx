import { useState } from "react";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useClients, useClientMutations, useSalesReps, usePayments, useLeads } from "@/hooks/queries";
import { formatClientLtvAmount, resolveClientLtv } from "@/lib/client-ltv";
import { useAuth } from "@/hooks/useAuth";
import { useStaffView } from "@/hooks/useSuperMode";
import { formatDate } from "@/lib/format";
import { Search, ExternalLink, X } from "lucide-react";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: "", contact: "", email: "", phone: "", country: "" });

  const { user } = useAuth();
  const { effectiveRepId, canStaffOverride, effectiveRep } = useStaffView();
  const { data: clients = [], isLoading, isError } = useClients();
  const { data: salesReps = [] } = useSalesReps();
  const { create } = useClientMutations();
  const { data: allPayments = [] } = usePayments();
  const { data: leads = [] } = useLeads();

  const scoped = effectiveRepId
    ? clients.filter((c) => c.manager_id === effectiveRepId)
    : clients;
  const filtered = scoped.filter(
    (c) =>
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    await create.mutateAsync({
      company: form.company,
      contact: form.contact,
      email: form.email,
      phone: form.phone || undefined,
      country: form.country || undefined,
      manager_id: user.id,
    });
    setForm({ company: "", contact: "", email: "", phone: "", country: "" });
    setShowForm(false);
  };

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isLoading ? "Loading..." : canStaffOverride && effectiveRep ? (
                <>Managing <strong>{effectiveRep.name}</strong>&apos;s clients — {scoped.length} active</>
              ) : (
                <>{scoped.length} active clients</>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            data-testid="btn-add-client"
          >
            + Add Client
          </button>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="input-search-clients"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6 text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-16 text-sm text-red-500">Failed to load clients.</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm" data-testid="clients-table">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Company</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Contact</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">LTV</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Deals</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Last Activity</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Account Manager</th>
                  <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wide text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((client) => {
                  const manager = salesReps.find((r) => r.id === client.manager_id);
                  const ltv = resolveClientLtv(client, leads, allPayments);
                  return (
                    <tr key={client.id} className="hover:bg-muted/40 transition-colors" data-testid={`client-row-${client.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground hover:text-primary transition-colors">
                          <Link href={`/clients/${client.id}`}>{client.company}</Link>
                        </div>
                        <div className="text-xs text-muted-foreground">{client.country}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{client.contact}</div>
                        <div className="text-xs text-muted-foreground">{client.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-foreground">{formatClientLtvAmount(ltv.amount, ltv.currency)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{client.deals_count}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(client.last_activity)}</td>
                      <td className="px-4 py-3">
                        {manager && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ backgroundColor: manager.color }}>
                              {manager.initials}
                            </div>
                            <span className="text-xs text-foreground">{manager.name.split(" ")[0]}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-primary text-xs font-medium hover:underline" data-testid={`link-view-client-${client.id}`}>
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-card-border rounded-xl shadow-lg w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-bold text-foreground">Add Client</h2>
                <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <input
                  required
                  placeholder="Company"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  required
                  placeholder="Contact name"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  required
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <input
                  placeholder="Country"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {create.isPending ? "Creating..." : "Create Client"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
