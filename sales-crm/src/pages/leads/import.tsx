import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { mockSplitRules } from "@/lib/mock-data";
import { Upload, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, FileText } from "lucide-react";

const STEPS = ["Upload File", "Map Columns", "Validate", "Split Rule", "Complete"];

const SYSTEM_FIELDS = ["First Name", "Last Name", "Email", "Phone", "Company", "Source", "Country", "Value"];
const SAMPLE_CSV_HEADERS = ["first_name", "last_name", "email_address", "phone_number", "company_name", "lead_source", "country", "deal_value"];

const DEFAULT_MAPPING: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  email_address: "Email",
  phone_number: "Phone",
  company_name: "Company",
  lead_source: "Source",
  country: "Country",
  deal_value: "Value",
};

const VALIDATION_ERRORS = [
  { row: 4, field: "Email", error: "Invalid email format" },
  { row: 11, field: "Phone", error: "Missing required field" },
  { row: 23, field: "Email", error: "Duplicate entry" },
  { row: 31, field: "Value", error: "Non-numeric value" },
  { row: 47, field: "Country", error: "Unrecognized country code" },
  { row: 52, field: "Email", error: "Invalid email format" },
  { row: 68, field: "Phone", error: "Invalid format" },
  { row: 79, field: "Email", error: "Duplicate entry" },
  { row: 93, field: "Company", error: "Missing required field" },
  { row: 112, field: "Email", error: "Invalid email format" },
  { row: 134, field: "Value", error: "Non-numeric value" },
  { row: 156, field: "Phone", error: "Missing required field" },
  { row: 178, field: "Email", error: "Duplicate entry" },
];

export default function LeadsImport() {
  const [step, setStep] = useState(0);
  const [mapping, setMapping] = useState(DEFAULT_MAPPING);
  const [selectedRule, setSelectedRule] = useState<number | null>(1);
  const [usingSample, setUsingSample] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

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
            <div className="bg-card border border-card-border rounded-xl p-8 shadow-sm">
              {!usingSample ? (
                <div
                  className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => { setUsingSample(true); next(); }}
                  data-testid="dropzone"
                >
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h2 className="font-display text-lg font-bold mb-2">Drag &amp; Drop your file here</h2>
                  <p className="text-sm text-muted-foreground mb-5 max-w-xs">Supports CSV and XLSX files up to 50MB. Ensure your file includes a header row.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setUsingSample(true); next(); }}
                      className="px-4 py-2 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                      data-testid="btn-sample-data"
                    >
                      Use sample data
                    </button>
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-select-file">
                      Select File
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {step === 1 && (
            <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <h2 className="font-display font-bold text-base text-foreground">Map CSV Columns to System Fields</h2>
                <p className="text-sm text-muted-foreground mt-1">Adjust the mappings if needed. 500 rows detected.</p>
              </div>
              <table className="w-full text-sm" data-testid="column-mapping-table">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">CSV Column</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">System Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SAMPLE_CSV_HEADERS.map((header) => (
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
                  <div className="font-display text-2xl font-bold text-emerald-700">487</div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">Valid Rows</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-red-600">{VALIDATION_ERRORS.length}</div>
                  <div className="text-xs text-red-500 font-medium mt-1">Errors</div>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4 text-center">
                  <div className="font-display text-2xl font-bold text-foreground">500</div>
                  <div className="text-xs text-muted-foreground font-medium mt-1">Total Rows</div>
                </div>
              </div>

              <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="font-semibold text-sm text-foreground">{VALIDATION_ERRORS.length} Validation Errors</span>
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
                    {VALIDATION_ERRORS.map((err, i) => (
                      <tr key={i} className="hover:bg-red-50/30">
                        <td className="px-4 py-2 font-mono text-muted-foreground">Row {err.row}</td>
                        <td className="px-4 py-2 font-medium text-foreground">{err.field}</td>
                        <td className="px-4 py-2 text-red-500">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between">
                <button onClick={prev} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" />Back</button>
                <button onClick={next} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" data-testid="btn-proceed-with-valid">Proceed with 487 valid rows <ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
                <h2 className="font-display font-bold text-base text-foreground mb-4">Select Assignment Rule</h2>
                <div className="space-y-3">
                  {mockSplitRules.map((rule) => (
                    <div
                      key={rule.id}
                      onClick={() => setSelectedRule(rule.id)}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedRule === rule.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                      } ${!rule.active ? "opacity-50" : ""}`}
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
                          <div className="text-xs text-muted-foreground mt-1 pl-6">{rule.mode.replace("_", " ")} · {rule.poolSize} reps · {rule.leadsAssigned.toLocaleString()} leads assigned</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-foreground">{rule.winRate}% win rate</div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${rule.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-muted text-muted-foreground border-border"}`}>
                            {rule.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={prev} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"><ChevronLeft className="w-4 h-4" />Back</button>
                <button onClick={next} disabled={!selectedRule} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" data-testid="btn-import-now">
                  Import 487 Leads <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-card border border-card-border rounded-xl p-10 shadow-sm text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h2 className="font-display text-xl font-bold text-foreground mb-2">Import Complete</h2>
              <p className="text-sm text-muted-foreground mb-6">487 leads imported and distributed via <strong>
                {mockSplitRules.find((r) => r.id === selectedRule)?.name}
              </strong>.</p>
              <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-display font-bold text-foreground">487</div>
                  <div className="text-xs text-muted-foreground">Leads Imported</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-display font-bold text-foreground">3</div>
                  <div className="text-xs text-muted-foreground">Reps in Pool</div>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="font-display font-bold text-foreground">~162</div>
                  <div className="text-xs text-muted-foreground">Leads per Rep</div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => { setStep(0); setUsingSample(false); }} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
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
