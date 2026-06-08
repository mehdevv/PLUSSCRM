import { useRef, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useSplitRules, useLeadMutations } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { downloadCSV } from "@/lib/export";
import { isValidUrl } from "@/lib/lead-import";
import Papa from "papaparse";
import { Upload, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, FileText, Download, Info } from "lucide-react";

/** Max rows per import — each row is saved individually to Supabase. */
const IMPORT_MAX_ROWS = 500;

const EXAMPLE_IMPORT_ROWS = [
  {
    "Full Name": "Karim Bensalah",
    Company: "Café El Djazair",
    Number: "+213 555 123 456",
    Wilaya: "Algiers",
    "Google Maps Link": "https://maps.google.com/?q=Cafe+El+Djazair+Algiers",
    "Website Link": "https://cafee-el-djazair.example.dz",
  },
  {
    "Full Name": "Yasmine Hadid",
    Company: "Oran Tech Solutions",
    Number: "+213 661 987 654",
    Wilaya: "Oran",
    "Google Maps Link": "https://maps.google.com/?q=Oran+Tech+Solutions",
    "Website Link": "https://orantech.example.dz",
  },
  {
    "Full Name": "Mohamed Amrani",
    Company: "Constantine Foods",
    Number: "+213 770 445 221",
    Wilaya: "Constantine",
    "Google Maps Link": "https://maps.google.com/?q=Constantine+Foods",
    "Website Link": "",
  },
];

const STEPS = ["Upload File", "Map Columns", "Validate", "Split Rule", "Complete"];

const SYSTEM_FIELDS = [
  "Full Name",
  "Company",
  "Number",
  "Wilaya",
  "Google Maps Link",
  "Website Link",
];

const FIELD_LABEL_TO_KEY: Record<string, string> = {
  "Full Name": "full_name",
  Company: "company",
  Number: "phone",
  Wilaya: "wilaya",
  "Google Maps Link": "google_maps_link",
  "Website Link": "website_link",
};

interface ValidationError {
  row: number;
  field: string;
  error: string;
}

function buildServiceMapping(uiMapping: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [csvCol, systemLabel] of Object.entries(uiMapping)) {
    if (!systemLabel) continue;
    const key = FIELD_LABEL_TO_KEY[systemLabel];
    if (key) result[key] = csvCol;
  }
  return result;
}

function validateRows(rows: Record<string, string>[], mapping: Record<string, string>): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  const serviceMapping = buildServiceMapping(mapping);

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const fullName = (row[serviceMapping.full_name ?? ""] ?? "").trim();
    const company = (row[serviceMapping.company ?? ""] ?? "").trim();
    const number = (row[serviceMapping.phone ?? ""] ?? "").trim();
    const mapsLink = (row[serviceMapping.google_maps_link ?? ""] ?? "").trim();
    const websiteLink = (row[serviceMapping.website_link ?? ""] ?? "").trim();

    if (!fullName) errors.push({ row: rowNum, field: "Full Name", error: "Missing required field" });
    if (!company) errors.push({ row: rowNum, field: "Company", error: "Missing required field" });
    if (!number) errors.push({ row: rowNum, field: "Number", error: "Missing required field" });

    const dedupeKey = `${company.toLowerCase()}|${number.replace(/\s/g, "")}`;
    if (company && number) {
      if (seen.has(dedupeKey)) {
        errors.push({ row: rowNum, field: "Company / Number", error: "Duplicate entry" });
      } else {
        seen.add(dedupeKey);
      }
    }

    if (mapsLink && !isValidUrl(mapsLink)) {
      errors.push({ row: rowNum, field: "Google Maps Link", error: "Invalid URL" });
    }
    if (websiteLink && !isValidUrl(websiteLink)) {
      errors.push({ row: rowNum, field: "Website Link", error: "Invalid URL" });
    }
  });

  return errors;
}

export default function LeadsImport() {
  const [step, setStep] = useState(0);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; error: string }[]; splitSummary: unknown } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { data: splitRules = [], isLoading: rulesLoading } = useSplitRules();
  const { importCsv } = useLeadMutations();

  const validationErrors = validateRows(csvRows, mapping);
  const validCount = csvRows.length - new Set(validationErrors.map((e) => e.row)).size;
  const selectedRuleData = splitRules.find((r) => r.id === selectedRule);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const downloadExampleTemplate = () => {
    downloadCSV("pluss-leads-import-template.csv", EXAMPLE_IMPORT_ROWS);
  };

  const parseFile = (file: File) => {
    setFileError(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Only CSV files are supported right now. Download the example template, edit it in Excel or Google Sheets, then save as CSV.");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rowCount = results.data.length;
        if (rowCount === 0) {
          setFileError("The file is empty or has no data rows. Use the example template and ensure your file includes a header row.");
          return;
        }
        if (rowCount > IMPORT_MAX_ROWS) {
          setFileError(
            `This file has ${rowCount.toLocaleString()} rows. Maximum ${IMPORT_MAX_ROWS.toLocaleString()} rows per import. Split your file into smaller batches so Supabase can save every lead reliably.`,
          );
          return;
        }

        const headers = results.meta.fields ?? [];
        setCsvHeaders(headers);
        setCsvRows(results.data);
        const defaultMap: Record<string, string> = {};
        headers.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes("full") && lower.includes("name")) defaultMap[h] = "Full Name";
          else if (lower === "name" || lower.includes("contact name")) defaultMap[h] = "Full Name";
          else if (lower.includes("company") || lower.includes("business")) defaultMap[h] = "Company";
          else if (lower.includes("number") || lower.includes("phone") || lower.includes("mobile") || lower.includes("tel")) defaultMap[h] = "Number";
          else if (lower.includes("wilaya") || lower.includes("province") || lower.includes("region")) defaultMap[h] = "Wilaya";
          else if (lower.includes("google") || lower.includes("maps") || lower.includes("map link")) defaultMap[h] = "Google Maps Link";
          else if (lower.includes("website") || lower.includes("site url") || (lower.includes("url") && !lower.includes("map"))) defaultMap[h] = "Website Link";
        });
        setMapping(defaultMap);
        next();
      },
    });
  };

  const handleImport = async () => {
    if (!selectedRule || !user?.id || !csvRows.length) return;
    const result = await importCsv.mutateAsync({
      rows: csvRows,
      mapping: buildServiceMapping(mapping),
      splitRuleId: selectedRule,
      userId: user.id,
    });
    setImportResult(result);
    next();
  };

  const reset = () => {
    setStep(0);
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setSelectedRule(null);
    setImportResult(null);
    setFileError(null);
  };

  if (rulesLoading && step === 3) {
    return (
      <Sidebar>
        <div className="p-6 min-h-full text-muted-foreground">Loading...</div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="p-6 min-h-full">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
          <span>Leads</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Import Leads</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">CSV / XLSX Import Wizard</h1>

        <div className="flex items-center gap-0 mb-8 overflow-x-auto">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? "bg-emerald-500 text-white" :
                    i === step ? "bg-primary text-white" :
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === step ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-px mx-2 ${i < step ? "bg-emerald-400" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="max-w-2xl">
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Row limit: {IMPORT_MAX_ROWS.toLocaleString()} leads per upload</p>
                  <p className="text-blue-800/90 leading-relaxed">
                    Each lead is saved individually to Supabase. Files with more than {IMPORT_MAX_ROWS.toLocaleString()} rows may time out or fail partway through.
                    Split larger lists into multiple files and import them one batch at a time.
                  </p>
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">Example template</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Download, fill in your leads, then upload the CSV below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadExampleTemplate}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex-shrink-0"
                    data-testid="btn-download-template"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV template
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border bg-muted/30">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted">
                        {Object.keys(EXAMPLE_IMPORT_ROWS[0]).map((col) => (
                          <th key={col} className="px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {EXAMPLE_IMPORT_ROWS.map((row, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-3 py-2 text-foreground whitespace-nowrap">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Required columns: <strong>Full Name</strong>, <strong>Company</strong>, <strong>Number</strong>. Optional: Wilaya, Google Maps Link, Website Link.
                </p>
              </div>

              <div className="bg-card border border-card-border rounded-xl p-8 shadow-sm">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseFile(file);
                    e.target.value = "";
                  }}
                />
                <div
                  className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone"
                >
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h2 className="font-display text-lg font-bold mb-2">Drag &amp; Drop your file here</h2>
                  <p className="text-sm text-muted-foreground mb-5 max-w-sm">
                    Upload a CSV file (max {IMPORT_MAX_ROWS.toLocaleString()} data rows). Include a header row matching the template above.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    data-testid="btn-select-file"
                  >
                    Select File
                  </button>
                </div>
                {fileError && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="file-error">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <h2 className="font-display font-bold text-base text-foreground">Map CSV Columns to System Fields</h2>
                <p className="text-sm text-muted-foreground mt-1">Adjust the mappings if needed. {csvRows.length} rows detected.</p>
              </div>
              <table className="w-full text-sm" data-testid="column-mapping-table">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">CSV Column</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {csvHeaders.map((header) => (
                    <tr key={header}>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{header}</td>
                      <td className="px-4 py-3">
                        <select
                          value={mapping[header] || ""}
                          onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                          className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
                          data-testid={`mapping-${header}`}
                        >
                          <option value="">— Skip —</option>
                          {SYSTEM_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex justify-between border-t border-border">
                <button onClick={prev} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" />Back</button>
                <button onClick={next} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-next-validate">Validate <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-emerald-700">{validCount}</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">Valid Rows</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-red-600">{validationErrors.length}</div>
                  <div className="text-xs text-red-500 font-medium mt-1">Errors</div>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-foreground">{csvRows.length}</div>
                  <div className="text-xs text-muted-foreground font-medium mt-1">Total Rows</div>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="font-semibold text-sm text-foreground">{validationErrors.length} Validation Errors</span>
                    <span className="text-xs text-muted-foreground ml-1">— These rows will be skipped</span>
                  </div>
                  <table className="w-full text-xs" data-testid="validation-errors-table">
                    <thead className="bg-muted border-b border-border">
                      <tr>
                        <th className="px-4 py-2 text-left text-muted-foreground font-semibold uppercase tracking-wide">Row</th>
                        <th className="px-4 py-2 text-left text-muted-foreground font-semibold uppercase tracking-wide">Field</th>
                        <th className="px-4 py-2 text-left text-muted-foreground font-semibold uppercase tracking-wide">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {validationErrors.slice(0, 50).map((err, i) => (
                        <tr key={i} className="hover:bg-red-50/30">
                          <td className="px-4 py-2 font-mono text-muted-foreground">Row {err.row}</td>
                          <td className="px-4 py-2 font-medium text-foreground">{err.field}</td>
                          <td className="px-4 py-2 text-red-500">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={prev} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" />Back</button>
                <button
                  onClick={next}
                  disabled={validCount === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  data-testid="btn-proceed-with-valid"
                >
                  Proceed with {validCount} valid rows <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <h2 className="font-display font-bold text-base text-foreground mb-4">Select Assignment Rule</h2>
                {splitRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No split rules configured. Create one first.</p>
                ) : (
                  <div className="space-y-3">
                    {splitRules.map((rule) => (
                      <div
                        key={rule.id}
                        onClick={() => rule.is_active && setSelectedRule(rule.id)}
                        className={`border rounded-xl p-4 cursor-pointer transition-all ${
                          selectedRule === rule.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        } ${!rule.is_active ? "opacity-50 cursor-not-allowed" : ""}`}
                        data-testid={`split-rule-card-${rule.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedRule === rule.id ? "border-primary" : "border-border"}`}>
                                {selectedRule === rule.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                              </div>
                              <span className="font-semibold text-sm text-foreground">{rule.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 pl-6">
                              {rule.mode.replace("_", " ")} · {rule.rep_pool.length} reps · {rule.leads_assigned.toLocaleString()} leads assigned
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-foreground">{rule.win_rate}% win rate</div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${rule.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                              {rule.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button onClick={prev} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" />Back</button>
                <button
                  onClick={handleImport}
                  disabled={!selectedRule || importCsv.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  data-testid="btn-import-now"
                >
                  {importCsv.isPending ? "Importing..." : `Import ${validCount} Leads`} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && importResult && (
            <div className="bg-card border border-card-border rounded-xl p-10 shadow-sm text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">Import Complete</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {importResult.imported} leads imported and distributed via <strong>{selectedRuleData?.name}</strong>.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-display font-bold text-foreground">{importResult.imported}</div>
                  <div className="text-xs text-muted-foreground">Leads Imported</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-display font-bold text-foreground">{selectedRuleData?.rep_pool.length ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Reps in Pool</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-display font-bold text-foreground">
                    {selectedRuleData?.rep_pool.length
                      ? `~${Math.round(importResult.imported / selectedRuleData.rep_pool.length)}`
                      : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Leads per Rep</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={reset} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                  Import Another
                </button>
                <a href="/leads" className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  <FileText className="w-4 h-4" />View Leads
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
