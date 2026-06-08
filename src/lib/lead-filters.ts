import type { Lead } from "@/types";

export type LinkFilter = "ALL" | "GOOGLE_MAPS" | "WEBSITE" | "BOTH" | "ANY" | "NONE";

export function hasGoogleMapsLink(lead: Lead) {
  return !!lead.google_maps_link?.trim();
}

export function hasWebsiteLink(lead: Lead) {
  return !!lead.website_link?.trim();
}

export function matchesLinkFilter(lead: Lead, filter: LinkFilter) {
  const maps = hasGoogleMapsLink(lead);
  const web = hasWebsiteLink(lead);
  switch (filter) {
    case "GOOGLE_MAPS": return maps;
    case "WEBSITE": return web;
    case "BOTH": return maps && web;
    case "ANY": return maps || web;
    case "NONE": return !maps && !web;
    default: return true;
  }
}

export function matchesLeadSearch(lead: Lead, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    lead.name,
    lead.first_name,
    lead.last_name,
    lead.company,
    lead.email,
    lead.phone,
    lead.source,
    lead.wilaya,
    lead.country,
    lead.industry,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
