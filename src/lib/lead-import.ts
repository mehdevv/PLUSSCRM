export function splitFullName(full: string): { first_name: string; last_name: string } {
  const trimmed = full.trim();
  if (!trimmed) return { first_name: "", last_name: "" };
  const space = trimmed.indexOf(" ");
  if (space === -1) return { first_name: trimmed, last_name: "." };
  const last = trimmed.slice(space + 1).trim();
  return { first_name: trimmed.slice(0, space), last_name: last || "." };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lead";
}

export function generateImportEmail(company: string, phone: string, rowIndex: number): string {
  return `${slug(company)}-${slug(phone)}-r${rowIndex}@import.pluss.crm`;
}

export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return !!url.hostname;
  } catch {
    return false;
  }
}
