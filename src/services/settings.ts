import { supabase } from "@/lib/supabase";
import type { PlatformSettings } from "@/types";

export async function fetchPlatformSettings(): Promise<PlatformSettings | null> {
  const { data, error } = await supabase.from("platform_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    company_name: data.company_name,
    timezone: data.timezone,
    currency: (data.currency === "DZD" ? "DZD" : "USD") as PlatformSettings["currency"],
    usd_to_dzd_rate: Number(data.usd_to_dzd_rate ?? 134),
    date_format: data.date_format,
    notification_prefs: (data.notification_prefs as Record<string, boolean>) ?? {},
    freemove_rep_ids: Array.isArray(data.freemove_rep_ids)
      ? (data.freemove_rep_ids as string[])
      : [],
  };
}

export async function updatePlatformSettings(updates: Partial<PlatformSettings>) {
  const existing = await fetchPlatformSettings();
  if (!existing) throw new Error("No platform settings found");
  const { error } = await supabase.from("platform_settings").update({
    company_name: updates.company_name,
    timezone: updates.timezone,
    currency: updates.currency,
    usd_to_dzd_rate: updates.usd_to_dzd_rate,
    date_format: updates.date_format,
    notification_prefs: updates.notification_prefs,
    freemove_rep_ids: updates.freemove_rep_ids,
    updated_at: new Date().toISOString(),
  }).eq("id", existing.id);
  if (error) throw error;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
