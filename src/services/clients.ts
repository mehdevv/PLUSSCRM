import { supabase } from "@/lib/supabase";
import { shouldPruneZeroLtvClient, sumPaymentAmounts } from "@/lib/client-ltv";
import { clientLeadIds } from "@/lib/client-ltv";
import { mapClient, mapClientNote, mapClientFile } from "@/lib/mappers";
import type { Client, Lead, Payment, PaymentStatus } from "@/types";

type PrunePayment = Pick<Payment, "lead_id" | "amount" | "currency" | "status">;
type PruneLead = Pick<Lead, "id" | "company" | "email" | "assigned_to">;

async function loadPruneContext(): Promise<{
  leads: PruneLead[];
  payments: PrunePayment[];
}> {
  const [leadsRes, paymentsRes] = await Promise.all([
    supabase.from("leads").select("id, company, email, assigned_to"),
    supabase.from("payments").select("lead_id, amount, currency, status"),
  ]);
  if (leadsRes.error) throw leadsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const leads = (leadsRes.data ?? []).map((l) => ({
    id: l.id as string,
    company: (l.company as string) ?? "",
    email: (l.email as string) ?? "",
    assigned_to: (l.assigned_to as string) ?? null,
  }));
  const payments: PrunePayment[] = (paymentsRes.data ?? []).map((r) => ({
    lead_id: r.lead_id as string,
    amount: Number(r.amount),
    currency: (r.currency as string) ?? "USD",
    status: r.status as PaymentStatus,
  }));
  return { leads, payments };
}

/** Remove clients with $0 LTV (no received payments). */
export async function pruneZeroLtvClients(): Promise<number> {
  const { data, error } = await supabase.from("clients").select("*");
  if (error) throw error;

  const candidates = (data ?? []).map((r) => mapClient(r as Record<string, unknown>));
  if (candidates.length === 0) return 0;

  const { leads, payments } = await loadPruneContext();
  const toRemove = candidates.filter((c) =>
    shouldPruneZeroLtvClient(c, leads, payments),
  );
  for (const client of toRemove) {
    await deleteClient(client.id);
  }
  return toRemove.length;
}

export async function deleteClientIfZeroLtv(client: Client): Promise<boolean> {
  const { leads, payments } = await loadPruneContext();
  if (!shouldPruneZeroLtvClient(client, leads, payments)) return false;
  await deleteClient(client.id);
  return true;
}

export async function fetchClients(): Promise<Client[]> {
  await pruneZeroLtvClients();
  const { data, error } = await supabase.from("clients").select("*").order("company");
  if (error) throw error;
  return (data ?? []).map((r) => mapClient(r as Record<string, unknown>));
}

export async function findClientByWonDeal(dealId: string): Promise<Client | null> {
  const { data, error } = await supabase.from("clients").select("*").eq("won_deal_id", dealId).maybeSingle();
  if (error) throw error;
  return data ? mapClient(data as Record<string, unknown>) : null;
}

export async function findClientByLead(company?: string | null, email?: string): Promise<Client | null> {
  const trimmedEmail = email?.trim();
  if (trimmedEmail) {
    const { data } = await supabase.from("clients").select("*").eq("email", trimmedEmail).maybeSingle();
    if (data) return mapClient(data as Record<string, unknown>);
  }
  if (company?.trim()) {
    const { data } = await supabase.from("clients").select("*").ilike("company", company.trim()).maybeSingle();
    if (data) return mapClient(data as Record<string, unknown>);
  }
  return null;
}

/** Create or update a client when a deal is marked won (app-layer fallback alongside DB trigger). */
export async function ensureClientFromWonDeal(
  input: {
    dealId: string;
    leadId: string;
    company: string;
    contact: string;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
  },
  managerId: string,
  dealValue: number,
  currency = "USD",
): Promise<Client | null> {
  const email = input.email?.trim() || `lead-${input.leadId}@clients.pluss`;
  const company = input.company?.trim() || "Unknown company";
  const contact = input.contact?.trim() || "Contact";

  const fromWin = await findClientByWonDeal(input.dealId);
  if (fromWin) return fromWin;

  const existing = await findClientByLead(company, email);

  if (existing && !existing.won_deal_id) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        ltv: existing.ltv + dealValue,
        deals_count: existing.deals_count + 1,
        last_activity: "Deal won",
        updated_at: new Date().toISOString(),
        phone: input.phone?.trim() || existing.phone,
        country: input.country?.trim() || existing.country,
        currency: dealValue > 0 ? currency : existing.currency,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    const updated = mapClient(data as Record<string, unknown>);
    if (await deleteClientIfZeroLtv(updated)) return null;
    return updated;
  }

  if (dealValue <= 0) return null;

  const row: Record<string, unknown> = {
    company,
    contact,
    email,
    phone: input.phone?.trim() || null,
    manager_id: managerId,
    country: input.country?.trim() || null,
    ltv: dealValue,
    deals_count: 1,
    last_activity: "Deal won",
    currency,
    won_deal_id: input.dealId,
  };

  let { data, error } = await supabase.from("clients").insert(row).select().single();
  if (error && /currency|column/i.test(error.message)) {
    const { currency: _omit, ...withoutCurrency } = row;
    const retry = await supabase.from("clients").insert(withoutCurrency).select().single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  return mapClient(data as Record<string, unknown>);
}

export async function flagClientRenewal(clientId: string, userId: string) {
  await addClientNote(clientId, userId, "Flagged for renewal follow-up.");
  const { error } = await supabase.from("clients").update({
    last_activity: "Renewal flagged",
    updated_at: new Date().toISOString(),
  }).eq("id", clientId);
  if (error) throw error;
}

export async function fetchClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw error;
  return data ? mapClient(data as Record<string, unknown>) : null;
}

export async function createClient(input: {
  company: string;
  contact: string;
  email: string;
  phone?: string;
  manager_id: string;
  country?: string;
}) {
  const { data, error } = await supabase.from("clients").insert({
    ...input,
    ltv: 0,
    deals_count: 0,
    last_activity: "Client created",
  }).select().single();
  if (error) throw error;
  return mapClient(data as Record<string, unknown>);
}

export async function fetchClientNotes(clientId: string) {
  const { data, error } = await supabase.from("client_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapClientNote(r as Record<string, unknown>));
}

export async function addClientNote(clientId: string, userId: string, content: string) {
  const { error } = await supabase.from("client_notes").insert({ client_id: clientId, user_id: userId, content });
  if (error) throw error;
}

export async function fetchClientFiles(clientId: string) {
  const { data, error } = await supabase.from("client_files").select("*").eq("client_id", clientId);
  if (error) throw error;
  return (data ?? []).map((r) => mapClientFile(r as Record<string, unknown>));
}

function safeStorageFileName(name: string): string {
  const base = name.replace(/[^\w.\-() ]+/g, "_").trim() || "receipt";
  return base.slice(0, 180);
}

export async function uploadClientFile(clientId: string, file: File, paymentId?: string) {
  const path = `${clientId}/${Date.now()}-${safeStorageFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from("client-files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) {
    throw new Error(
      upErr.message.includes("Bucket not found")
        ? "Storage bucket missing. Create private bucket client-files in Supabase Storage and run migration 013."
        : `Upload failed: ${upErr.message}`,
    );
  }

  const baseRow = {
    client_id: clientId,
    file_name: file.name,
    file_path: path,
  };

  if (paymentId) {
    const { error } = await supabase.from("client_files").insert({
      ...baseRow,
      payment_id: paymentId,
    });
    if (!error) return;
    if (!/payment_id|column/i.test(error.message)) {
      throw new Error(`Could not save file record: ${error.message}`);
    }
  }

  const { error: fallbackErr } = await supabase.from("client_files").insert(baseRow);
  if (fallbackErr) throw new Error(`Could not save file record: ${fallbackErr.message}`);
}

export async function getClientFileUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(filePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

/** Recompute stored LTV from received payments (source of truth for client value). */
export async function syncClientLtvFromPayments(client: Client): Promise<Client | null> {
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, company, email, assigned_to")
    .eq("assigned_to", client.manager_id);
  if (leadsErr) throw leadsErr;

  const leadIds = [...clientLeadIds(client, (leads ?? []) as PruneLead[])];
  if (leadIds.length === 0) return client;

  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("amount, currency, status")
    .in("lead_id", leadIds);
  if (payErr) throw payErr;

  const summed = sumPaymentAmounts(
    (payments ?? []).map((p) => ({
      amount: Number(p.amount),
      currency: (p.currency as string) ?? client.currency,
      status: String(p.status),
    })),
  );
  const nextLtv = summed?.amount ?? 0;
  const nextCurrency = summed?.currency ?? client.currency;

  const { data, error } = await supabase
    .from("clients")
    .update({
      ltv: nextLtv,
      currency: nextCurrency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id)
    .select()
    .single();
  if (error) throw error;
  const result = mapClient(data as Record<string, unknown>);

  if (await deleteClientIfZeroLtv(result)) return null;
  return result;
}

export async function fetchClientDeals(clientId: string) {
  const client = await fetchClient(clientId);
  if (!client) return [];
  const { data, error } = await supabase
    .from("deals")
    .select("*, leads(first_name, last_name, company)")
    .eq("leads.company", client.company);
  if (error) {
    const { data: d2, error: e2 } = await supabase.from("deals").select("*, leads!inner(first_name, last_name, company)").eq("leads.company", client.company);
    if (e2) throw e2;
    return d2 ?? [];
  }
  return data ?? [];
}
