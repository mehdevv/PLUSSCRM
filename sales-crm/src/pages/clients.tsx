import { useState } from "react";
import { Link } from "wouter";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockClients, salesReps } from "@/lib/mock-data";
import { Search, ExternalLink } from "lucide-react";

export default function Clients() {
  const [search, setSearch] = useState("");

  const filtered = mockClients.filter(
    (c) =>
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{mockClients.length} active clients</p>
          </div>
          <button className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-add-client">
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
                const manager = salesReps.find((r) => r.id === client.managerId);
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
                      <span className="font-semibold text-foreground">${client.ltv.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{client.deals}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{client.lastActivity}</td>
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
      </div>
    </Sidebar>
  );
}
