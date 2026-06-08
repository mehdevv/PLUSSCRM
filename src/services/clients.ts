import { supabase } from "@/lib/supabase";
import { sumPaymentAmounts } from "@/lib/client-ltv";
import { mapClient, mapClientNote, mapClientFile } from "@/lib/mappers";
import type { Client } from "@/types";

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("company");
  if (error) throw error;
  return (data ?? []).map((r) => mapClient(r as Record<string, unknown>));
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
): Promise<Client> {
  const email = input.email?.trim() || `lead-${input.leadId}@clients.pluss`;
  const company = input.company?.trim() || "Unknown company";
  const contact = input.contact?.trim() || "Contact";

  const existing = await findClientByLead(company, email);

  if (existing) {
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
    return mapClient(data as Record<string, unknown>);
  }

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

function clientMatchesLead(
  client: Client,
  lead?: { company?: string | null; email?: string | null } | null,
): boolean {
  if (!lead) return false;
  const clientCompany = client.company?.trim().toLowerCase() ?? "";
  const leadCompany = lead.company?.trim().toLowerCase() ?? "";
  if (clientCompany && leadCompany && clientCompany === leadCompany) return true;
  const clientEmail = client.email?.trim().toLowerCase() ?? "";
  const leadEmail = lead.email?.trim().toLowerCase() ?? "";
  return Boolean(clientEmail && leadEmail && clientEmail === leadEmail);
}

/** Recompute stored LTV from received payments (source of truth for client value). */
export async function syncClientLtvFromPayments(client: Client): Promise<Client> {
  const { data: deals, error: dealsErr } = await supabase
    .from("deals")
    .select("id, stage, rep_id, leads(company, email)")
    .eq("stage", "WON")
    .eq("rep_id", client.manager_id);
  if (dealsErr) throw dealsErr;

  const dealIds = (deals ?? [])
    .filter((d) => {
      const lead = (d as { leads?: { company?: string; email?: string } }).leads;
      return clientMatchesLead(client, lead);
    })
    .map((d) => d.id as string);
  if (dealIds.length === 0) return client;

  const { data: payments, error: payErr } = await supabase
    .from("payments")
    .select("amount, currency, status")
    .in("deal_id", dealIds);
  if (payErr) throw payErr;

  const summed = sumPaymentAmounts(
    (payments ?? []).map((p) => ({
      amount: Number(p.amount),
      currency: (p.currency as string) ?? client.currency,
      status: String(p.status),
    })),
  );
  if (!summed) return client;

  const { data, error } = await supabase
    .from("clients")
    .update({
      ltv: summed.amount,
      currency: summed.currency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", client.id)
    .select()
    .single();
  if (error) throw error;
  return mapClient(data as Record<string, unknown>);
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
