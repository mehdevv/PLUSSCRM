import type { LeadFormValues } from "@/components/leads/LeadEditModal";
import type { Lead } from "@/types";

export function leadFormToUpdates(values: LeadFormValues, isAdmin: boolean): Partial<Lead> {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
    company: values.company.trim() || undefined,
    phone: values.phone.trim() || undefined,
    wilaya: values.wilaya.trim() || undefined,
    google_maps_link: values.google_maps_link.trim() || undefined,
    website_link: values.website_link.trim() || undefined,
    source: values.source.trim() || undefined,
    value: values.value ? Number(values.value) : 0,
    notes: values.notes.trim() || undefined,
    ...(isAdmin ? { status: values.status } : {}),
  };
}
