import { supabase } from "@/lib/supabase";
import { mapCommission, mapCompPlan } from "@/lib/mappers";
import type { Commission, CompensationPlan, RepTier } from "@/types";

async function adminApi<T>(path: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({})) as { error?: string } & T;
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

export async function deleteSalesRep(repId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const res = await fetch("/api/delete-rep", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repId }),
  });

  const payload = await res.json().catch(() => ({})) as { error?: string; repId?: string };

  if (res.ok) return payload;

  if (res.status === 404) {
    const { data, error } = await supabase.functions.invoke("delete-rep", { body: { repId } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error as string);
    return data;
  }

  throw new Error(payload.error || `Delete failed (${res.status})`);
}

export async function deleteCommission(id: string) {
  const { error } = await supabase.from("commissions").delete().eq("id", id);
  if (error) throw error;
}

export async function inviteSalesRep(input: {
  email: string;
  password: string;
  name: string;
  initials?: string;
  color?: string;
  tier?: RepTier;
}) {
  return adminApi<{ userId: string; email: string }>("/api/invite-rep", input);
}

export async function fetchCompensationPlans(): Promise<CompensationPlan[]> {
  const { data, error } = await supabase.from("compensation_plans").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapCompPlan(r as Record<string, unknown>));
}

export async function fetchCommissions(): Promise<Commission[]> {
  const { data, error } = await supabase
    .from("commissions")
    .select("*, profiles(name), deals(value, leads(first_name, last_name, company))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as {
      profiles?: { name: string };
      deals?: { value: number; leads?: { first_name: string; last_name: string; company: string } };
    };
    const dealLabel = row.deals?.leads
      ? `${row.deals.leads.company} — $${Number(row.deals.value).toLocaleString()}`
      : "";
    return mapCommission(r as Record<string, unknown>, row.profiles?.name, dealLabel);
  });
}

export async function payCommission(id: string) {
  const { error } = await supabase.from("commissions").update({
    status: "PAID",
    paid_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function updateCommission(
  id: string,
  updates: { rate?: number; amount?: number; status?: "PAID" | "PENDING" },
) {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.status === "PAID") payload.paid_at = new Date().toISOString();
  if (updates.status === "PENDING") payload.paid_at = null;
  const { error } = await supabase.from("commissions").update(payload).eq("id", id);
  if (error) throw error;
}

export async function fetchExpenses() {
  const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAccountingSummary() {
  const { data: payments } = await supabase.from("payments").select("amount, currency, status, received_at").eq("status", "RECEIVED");
  const { data: expenses } = await supabase.from("expenses").select("amount, category, expense_date");
  const { data: commissions } = await supabase.from("commissions").select("amount, status");
  const revenue = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const expenseTotal = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const commTotal = (commissions ?? []).reduce((s, c) => s + Number(c.amount), 0);
  return { revenue, expenseTotal, commTotal, net: revenue - expenseTotal - commTotal, payments: payments ?? [], expenses: expenses ?? [] };
}
