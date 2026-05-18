import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useGetFeeDefaulters } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, AlertTriangle } from "lucide-react";

// margin:0 removes browser URL/date from print output
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body > *:not(#kips-print-portal) { display: none !important; }
    #kips-print-portal {
      display: block !important;
      position: static !important;
      width: 100% !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      color: #111827 !important;
      padding: 14mm 14mm !important;
      box-sizing: border-box !important;
    }
    #kips-print-portal * { font-family: Arial, sans-serif !important; }
    table { border-collapse: collapse !important; width: 100% !important; }
    tr    { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

const printDate = new Date().toLocaleDateString("en-PK", {
  day: "numeric", month: "long", year: "numeric",
});

// Shared inline cell styles
const TH: React.CSSProperties = {
  padding: "7px 9px", background: "#fee2e2", color: "#7f1d1d",
  fontWeight: 700, fontSize: 9, textAlign: "left",
  border: "1px solid #fca5a5",
};
const TD: React.CSSProperties = {
  padding: "6px 9px", border: "1px solid #e5e7eb",
  fontSize: 9, color: "#1f2937", background: "#ffffff",
};
const TDA: React.CSSProperties = { ...TD, background: "#fff7f7" };

export default function FeeDefaulters() {
  const { data: defaulters, isLoading } = useGetFeeDefaulters();

  useEffect(() => {
    const prev = document.getElementById("kips-print-styles");
    if (prev) prev.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const list         = defaulters ?? [];
  const totalPending = list.reduce((s, f) => s + (f.amount ?? 0), 0);
  const totalFine    = list.reduce((s, f) => s + (f.fine   ?? 0), 0);
  const grandTotal   = totalPending + totalFine;

  // Build class groups
  const byClass: Record<string, typeof list> = {};
  for (const f of list) {
    const key = f.className || "No Class";
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(f);
  }
  const classNames = Object.keys(byClass).sort();

  // ─── PRINT PORTAL ──────────────────────────────────────────────────────────
  // NOTE: Portal is hidden off-screen on screen, only visible when printing.
  // Everything is static inline JSX — no functions, no state, no conditionals.
  const printPortal = createPortal(
    <div
      id="kips-print-portal"
      style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: "210mm",
        fontFamily: "Arial, sans-serif",
        background: "white",
        color: "#111827",
        padding: "14mm 14mm",
        boxSizing: "border-box",
      }}
    >
      {/* ── Letterhead ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 72, height: 72, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 21, fontWeight: 900, color: "#1e3a8a", margin: 0 }}>KIPS School Hassari</div>
          <div style={{ fontSize: 11, color: "#ea580c", fontWeight: 700, marginTop: 3 }}>Bright Future — School Portal</div>
          <div style={{ fontSize: 9, color: "#6b7280", marginTop: 3 }}>Fee Defaulters Report</div>
          <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Printed: {printDate}</div>
        </div>
      </div>

      {/* ── Report title ── */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#991b1b" }}>Class-wise Fee Defaulters</div>
        <div style={{ fontSize: 9, color: "#6b7280", marginTop: 3 }}>Students with unpaid / overdue fees</div>
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {([
          { label: "Total Defaulters",  value: String(list.length),                      color: "#1d4ed8" },
          { label: "Classes Affected",  value: String(classNames.length),                color: "#7c3aed" },
          { label: "Total Amount Due",  value: `PKR ${totalPending.toLocaleString()}`,   color: "#b91c1c" },
          { label: "Total Fine",        value: `PKR ${totalFine.toLocaleString()}`,       color: "#c2410c" },
          { label: "Grand Total",       value: `PKR ${grandTotal.toLocaleString()}`,      color: "#7c2d12" },
        ] as { label: string; value: string; color: string }[]).map(c => (
          <div key={c.label} style={{ flex: "1 1 0", border: `2px solid ${c.color}`, borderRadius: 7, padding: "9px 6px", textAlign: "center", background: "#f9fafb" }}>
            <div style={{ fontSize: 7, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</div>
            <div style={{ fontSize: 12, fontWeight: 900, color: c.color, marginTop: 5 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Class-wise student tables ── */}
      {list.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", fontStyle: "italic", padding: "30px 0", fontSize: 11 }}>
          No defaulters — All fees are cleared!
        </div>
      ) : (
        <div>
          {classNames.map(cls => {
            const rows      = byClass[cls];
            const classDue  = rows.reduce((s, f) => s + (f.amount ?? 0), 0);
            const classFine = rows.reduce((s, f) => s + (f.fine   ?? 0), 0);

            return (
              <div key={cls} style={{ marginBottom: 20 }}>
                {/* Class heading bar */}
                <div style={{
                  background: "#1e3a8a", color: "white",
                  padding: "7px 12px", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                  borderRadius: "5px 5px 0 0",
                }}>
                  <span style={{ fontWeight: 800, fontSize: 11 }}>{cls}</span>
                  <span style={{ fontSize: 9, opacity: 0.85 }}>
                    {rows.length} student{rows.length !== 1 ? "s" : ""} &nbsp;|&nbsp; Total Due: PKR {(classDue + classFine).toLocaleString()}
                  </span>
                </div>

                {/* Student table */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={TH}>#</th>
                      <th style={TH}>Student Name</th>
                      <th style={TH}>Adm#</th>
                      <th style={TH}>Month</th>
                      <th style={TH}>Amount Due</th>
                      <th style={TH}>Fine</th>
                      <th style={TH}>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((fee, i) => (
                      <tr key={fee.id}>
                        <td style={i % 2 === 0 ? TD : TDA}>{i + 1}</td>
                        <td style={{ ...(i % 2 === 0 ? TD : TDA), fontWeight: 600 }}>{fee.studentName || "—"}</td>
                        <td style={i % 2 === 0 ? TD : TDA}>{fee.admissionNumber || "—"}</td>
                        <td style={i % 2 === 0 ? TD : TDA}>{fee.month}</td>
                        <td style={{ ...(i % 2 === 0 ? TD : TDA), color: "#b91c1c", fontWeight: 700 }}>
                          PKR {(fee.amount ?? 0).toLocaleString()}
                        </td>
                        <td style={i % 2 === 0 ? TD : TDA}>
                          {(fee.fine ?? 0) > 0 ? `PKR ${(fee.fine ?? 0).toLocaleString()}` : "—"}
                        </td>
                        <td style={i % 2 === 0 ? TD : TDA}>{fee.dueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ ...TH, background: "#fef2f2" }}>Class Total</td>
                      <td style={{ ...TH, background: "#fef2f2", color: "#b91c1c" }}>
                        PKR {classDue.toLocaleString()}
                      </td>
                      <td style={{ ...TH, background: "#fef2f2", color: "#c2410c" }}>
                        {classFine > 0 ? `PKR ${classFine.toLocaleString()}` : "—"}
                      </td>
                      <td style={{ ...TH, background: "#fef2f2" }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}

          {/* Grand total */}
          <div style={{
            background: "#7f1d1d", color: "white",
            padding: "10px 14px", borderRadius: 6,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 8,
          }}>
            <span style={{ fontWeight: 800, fontSize: 12 }}>
              Grand Total — All Classes ({list.length} students)
            </span>
            <span style={{ fontWeight: 900, fontSize: 14 }}>
              PKR {grandTotal.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 24, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 7, color: "#9ca3af" }}>KIPS School Hassari — Bright Future School Management Portal</span>
        <span style={{ fontSize: 7, color: "#9ca3af" }}>Generated: {printDate}</span>
      </div>
    </div>,
    document.body
  );

  // ─── SCREEN VIEW ───────────────────────────────────────────────────────────
  return (
    <>
      {printPortal}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" /> Fee Defaulters
            </h1>
            <p className="text-gray-500 text-sm mt-1">Students with unpaid fees</p>
          </div>
          <Button variant="outline" onClick={() => window.print()} data-testid="button-print-defaulters">
            <Printer className="w-4 h-4 mr-1" /> Print Report
          </Button>
        </div>

        {/* Summary cards (screen) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Defaulters", value: list.length,                            gradient: "from-blue-500 to-cyan-500" },
            { label: "Classes Affected", value: classNames.length,                      gradient: "from-violet-500 to-purple-600" },
            { label: "Amount Due",       value: `PKR ${totalPending.toLocaleString()}`, gradient: "from-red-500 to-rose-600" },
            { label: "Grand Total",      value: `PKR ${grandTotal.toLocaleString()}`,   gradient: "from-orange-500 to-red-600" },
          ].map(c => (
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${c.gradient} p-4`}>
                  <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                  <p className="text-white text-xl font-bold mt-1">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Screen table — class-wise */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : list.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg font-medium text-emerald-600">No defaulters!</p>
                <p className="text-sm mt-1">All fees are cleared</p>
              </div>
            ) : (
              <div className="divide-y">
                {classNames.map(cls => (
                  <div key={cls}>
                    {/* Class header */}
                    <div className="px-4 py-2 bg-blue-50 flex items-center justify-between">
                      <span className="text-sm font-bold text-blue-800">{cls}</span>
                      <span className="text-xs text-blue-600">
                        {byClass[cls].length} student{byClass[cls].length !== 1 ? "s" : ""} &nbsp;|&nbsp;
                        PKR {byClass[cls].reduce((s, f) => s + (f.amount ?? 0) + (f.fine ?? 0), 0).toLocaleString()}
                      </span>
                    </div>
                    {/* Class student table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50">
                          <tr>
                            {["#", "Student Name", "Adm#", "Month", "Amount Due", "Fine", "Due Date"].map(h => (
                              <th key={h} className="text-left py-2.5 px-3 font-semibold text-red-700 text-xs">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {byClass[cls].map((fee, i) => (
                            <tr key={fee.id} className="border-b hover:bg-red-50/40" data-testid={`row-defaulter-${fee.id}`}>
                              <td className="py-2.5 px-3 text-gray-500 text-xs">{i + 1}</td>
                              <td className="py-2.5 px-3 font-medium text-gray-900">{fee.studentName || "—"}</td>
                              <td className="py-2.5 px-3 text-xs font-mono text-purple-600">{fee.admissionNumber || "—"}</td>
                              <td className="py-2.5 px-3 text-gray-600">{fee.month}</td>
                              <td className="py-2.5 px-3 font-bold text-red-600">PKR {(fee.amount ?? 0).toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-orange-600">
                                {(fee.fine ?? 0) > 0 ? `PKR ${(fee.fine ?? 0).toLocaleString()}` : "—"}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500">{fee.dueDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Grand total row (screen) */}
                <div className="px-4 py-3 bg-gray-900 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Grand Total — {list.length} students</span>
                  <span className="text-sm font-bold text-red-300">PKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
