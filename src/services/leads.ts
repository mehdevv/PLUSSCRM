import { supabase } from "@/lib/supabase";
import { mapLead } from "@/lib/mappers";
import { generateImportEmail, splitFullName } from "@/lib/lead-import";
import type { Lead, LeadStatus } from "@/types";

export async function fetchLeads(filters?: { status?: LeadStatus; search?: string }): Promise<Lead[]> {
  let q = supabase.from("leads").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.search) q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,company.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapLead(r as Record<string, unknown>));
}

export async function fetchLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw error;
  return data ? mapLead(data as Record<string, unknown>) : null;
}

export async function createLead(input: {
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  phone?: string;
  source?: string;
  country?: string;
  industry?: string;
  value?: number;
  notes?: string;
}) {
  const { data, error } = await supabase.from("leads").insert({
    ...input,
    status: "NEW",
  }).select().single();
  if (error) throw error;
  return mapLead(data as Record<string, unknown>);
}

export async function updateLead(id: string, updates: Partial<Lead>) {
  const { error } = await supabase.from("leads").update({
    first_name: updates.first_name,
    last_name: updates.last_name,
    company: updates.company,
    email: updates.email,
    phone: updates.phone,
    status: updates.status,
    source: updates.source,
    assigned_to: updates.assigned_to,
    country: updates.country,
    wilaya: updates.wilaya,
    google_maps_link: updates.google_maps_link,
    website_link: updates.website_link,
    industry: updates.industry,
    value: updates.value,
    notes: updates.notes,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

export async function unassignLead(leadId: string) {
  const { error } = await supabase.from("leads").update({
    assigned_to: null,
    status: "NEW",
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (error) throw error;
}

export async function assignLead(leadId: string, repId: string, reason = "manual") {
  const { error } = await supabase.from("leads").update({
    assigned_to: repId,
    status: "ASSIGNED",
    updated_at: new Date().toISOString(),
  }).eq("id", leadId);
  if (error) throw error;
  await supabase.from("assignment_audit").insert({
    lead_id: leadId,
    rep_id: repId,
    reason,
  });
  await supabase.from("notifications").insert({
    user_id: repId,
    title: "Lead Assigned",
    message: "A lead has been manually assigned to you",
  });
}

export async function bulkAssignLeads(leadIds: string[], repId: string) {
  for (const id of leadIds) await assignLead(id, repId);
}

export async function softDeleteLead(id: string) {
  const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function fetchQueueLeads(): Promise<Lead[]> {
  const { data: queue, error } = await supabase.from("assignment_queue").select("lead_id");
  if (error) throw error;
  const ids = (queue ?? []).map((q) => q.lead_id);
  if (!ids.length) {
    const { data: unassigned } = await supabase.from("leads").select("*").is("assigned_to", null).eq("status", "NEW").is("deleted_at", null);
    return (unassigned ?? []).map((r) => mapLead(r as Record<string, unknown>));
  }
  const { data, error: e2 } = await supabase.from("leads").select("*").in("id", ids);
  if (e2) throw e2;
  return (data ?? []).map((r) => mapLead(r as Record<string, unknown>));
}

const IMPORT_MAX_ROWS = 500;

export async function importLeadsFromRows(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  splitRuleId: string,
  userId: string,
) {
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new Error(`Import exceeds the ${IMPORT_MAX_ROWS} row limit. Split your file into smaller batches.`);
  }

  const errors: { row: number; error: string }[] = [];
  const validIds: string[] = [];

  const job = await supabase.from("import_jobs").insert({
    status: "processing",
    mapping,
    split_rule_id: splitRuleId,
    total_rows: rows.length,
    created_by: userId,
  }).select().single();

  if (job.error) throw job.error;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = (row[mapping.full_name] ?? row.full_name ?? "").trim();
    const company = (row[mapping.company] ?? row.company ?? "").trim();
    const phone = (row[mapping.phone] ?? row.phone ?? "").trim();
    if (!fullName || !company || !phone) {
      errors.push({ row: i + 1, error: "Missing required fields (Full Name, Company, Number)" });
      continue;
    }
    const { first_name, last_name } = splitFullName(fullName);
    const email = generateImportEmail(company, phone, i + 1);
    const wilaya = (row[mapping.wilaya] ?? row.wilaya ?? "").trim() || null;
    const googleMaps = (row[mapping.google_maps_link] ?? row.google_maps_link ?? "").trim() || null;
    const website = (row[mapping.website_link] ?? row.website_link ?? "").trim() || null;
    const { data, error } = await supabase.from("leads").insert({
      first_name,
      last_name,
      email,
      phone,
      company,
      source: "CSV Import",
      wilaya,
      google_maps_link: googleMaps,
      website_link: website,
      status: "NEW",
    }).select("id").single();
    if (error) {
      errors.push({ row: i + 1, error: error.message });
    } else if (data) {
      validIds.push(data.id);
    }
  }

  let splitSummary = null;
  if (validIds.length && splitRuleId) {
    const { data: splitResult } = await supabase.rpc("run_split_engine", {
      p_lead_ids: validIds,
      p_rule_id: splitRuleId,
    });
    splitSummary = splitResult;
  }

  await supabase.from("import_jobs").update({
    status: "completed",
    success_rows: validIds.length,
    failed_rows: errors.length,
    error_report: errors,
    split_summary: splitSummary,
    completed_at: new Date().toISOString(),
  }).eq("id", job.data!.id);

  return { jobId: job.data!.id, imported: validIds.length, errors, splitSummary };
}
