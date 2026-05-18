import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useListFees } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClipboardList, Printer, AlertTriangle } from "lucide-react";

// @page margin:0 removes browser URL / date headers & footers from print
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body > *:not(#kips-print-portal) { display: none !important; }
    #kips-print-portal {
      display: block !important;
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      color: #111827 !important;
      font-size: 11pt !important;
      padding: 14mm 14mm !important;
      box-sizing: border-box !important;
    }
    #kips-print-portal * { font-family: Arial, sans-serif !important; }
    table { border-collapse: collapse !important; width: 100% !important; page-break-inside: auto; }
    tr    { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

interface StudentArrears {
  studentId:       number;
  studentName:     string;
  admissionNumber: string;
  className:       string;
  months:          { month: string; amount: number; remaining: number; fine: number }[];
  totalArrears:    number;
}

export default function Arrears() {
  const { data: fees, isLoading } = useListFees({});

  useEffect(() => {
    const existing = document.getElementById("kips-print-styles");
    if (existing) existing.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const overdueFees = (fees ?? []).filter(f =>
    (f.status === "unpaid" || f.status === "partial") && f.dueDate < today
  );

  const byStudent: Record<number, StudentArrears> = {};
  for (const f of overdueFees) {
    const sid = f.studentId;
    if (!byStudent[sid]) {
      byStudent[sid] = {
        studentId:       sid,
        studentName:     f.studentName ?? "—",
        admissionNumber: f.admissionNumber ?? "—",
        className:       f.className ?? "—",
        months:          [],
        totalArrears:    0,
      };
    }
    const remaining = f.remainingAmount ?? (f.amount - (f.paidAmount ?? 0));
    const fine = f.fine ?? 0;
    byStudent[sid].months.push({ month: f.month, amount: f.amount, remaining, fine });
    byStudent[sid].totalArrears += remaining + fine;
  }

  const arrears    = Object.values(byStudent).sort((a, b) => b.totalArrears - a.totalArrears);
  const grandTotal = arrears.reduce((s, a) => s + a.totalArrears, 0);

  // Print styles
  const thO = { padding: "7px 10px", background: "#fed7aa", color: "#7c2d12", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #fb923c" };
  const thI = { padding: "6px 8px", background: "#fef3c7", color: "#78350f", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #fcd34d" };
  const td  = { padding: "6px 8px", border: "1px solid #e5e7eb", fontSize: 9, color: "#1f2937", background: "#ffffff" };

  const printPortal = createPortal(
    <div id="kips-print-portal" style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif", background: "white", color: "#111827" }}>

      {/* Letterhead */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e3a8a" }}>KIPS School Hassari</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#ea580c", fontWeight: 700 }}>Bright Future — School Portal</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#6b7280" }}>{printDate}</p>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#c2410c" }}>Fee Arrears Report</h2>
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#6b7280" }}>Overdue unpaid/partial fees grouped by student</p>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Students with Arrears", value: arrears.length,              color: "#1d4ed8" },
          { label: "Overdue Records",        value: overdueFees.length,          color: "#c2410c" },
          { label: "Grand Total Arrears",    value: `PKR ${grandTotal.toLocaleString()}`, color: "#7c2d12" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 0", border: `2px solid ${c.color}`, borderRadius: 8, padding: "10px 8px", textAlign: "center", background: "#f9fafb" }}>
            <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7 }}>{c.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 900, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Per student tables */}
      {arrears.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontStyle: "italic" }}>No arrears found — All fees are up to date</div>
      ) : arrears.map((s, si) => (
        <div key={s.studentId} style={{ marginBottom: 18, border: "2px solid #e07b1a", borderRadius: 8, overflow: "hidden" }}>
          {/* Student header */}
          <div style={{ background: "#fff7ed", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #fed7aa" }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 11, color: "#7c2d12" }}>{si + 1}. {s.studentName}</span>
              <span style={{ marginLeft: 10, fontSize: 9, color: "#92400e", fontFamily: "monospace" }}>{s.admissionNumber}</span>
              <span style={{ marginLeft: 8, fontSize: 9, color: "#6b7280" }}>{s.className}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 8, color: "#6b7280" }}>Total Arrears</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#b91c1c" }}>PKR {s.totalArrears.toLocaleString()}</p>
            </div>
          </div>
          {/* Month breakdown */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Month","Fee","Remaining","Fine","Total Due"].map(h => <th key={h} style={thI}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {s.months.map(m => (
                <tr key={m.month}>
                  <td style={td}>{m.month}</td>
                  <td style={td}>PKR {m.amount.toLocaleString()}</td>
                  <td style={{ ...td, color: "#b91c1c" }}>PKR {m.remaining.toLocaleString()}</td>
                  <td style={{ ...td, color: "#c2410c" }}>{m.fine > 0 ? `PKR ${m.fine.toLocaleString()}` : "—"}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#7f1d1d" }}>PKR {(m.remaining + m.fine).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Grand total */}
      {arrears.length > 0 && (
        <div style={{ border: "2px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", background: "#fef2f2", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 12, color: "#7f1d1d" }}>Grand Total Arrears</p>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 22, color: "#991b1b" }}>PKR {grandTotal.toLocaleString()}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 28, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 8, color: "#9ca3af" }}>KIPS School Hassari — Bright Future School Management Portal</p>
        <p style={{ margin: 0, fontSize: 8, color: "#9ca3af" }}>Generated: {printDate}</p>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {printPortal}

      <div className="space-y-6">
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-orange-600" /> Fee Arrears
            </h1>
            <p className="text-gray-500 text-sm mt-1">Overdue unpaid/partial fees grouped by student</p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : arrears.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No arrears found</p>
              <p className="text-gray-400 text-sm mt-1">All fees are up to date</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 no-print">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <span className="text-sm text-red-700 font-medium">
                {arrears.length} students have overdue fees — Total Arrears: PKR {grandTotal.toLocaleString()}
              </span>
            </div>

            <div className="space-y-4">
              {arrears.map(s => (
                <Card key={s.studentId} className="overflow-hidden border-l-4" style={{ borderLeftColor: "#e07b1a" }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{s.studentName}</h3>
                        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                          <span className="font-mono text-purple-600">{s.admissionNumber}</span>
                          <span>{s.className}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total Arrears</p>
                        <p className="text-xl font-bold text-red-600">PKR {s.totalArrears.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b">
                            <th className="text-left py-1.5 pr-4">Month</th>
                            <th className="text-right pr-4">Fee</th>
                            <th className="text-right pr-4">Remaining</th>
                            <th className="text-right pr-4">Fine</th>
                            <th className="text-right">Total Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.months.map(m => (
                            <tr key={m.month} className="border-b last:border-0">
                              <td className="py-1.5 pr-4 font-medium text-gray-700">{m.month}</td>
                              <td className="py-1.5 pr-4 text-right text-gray-600">PKR {m.amount.toLocaleString()}</td>
                              <td className="py-1.5 pr-4 text-right text-red-600">PKR {m.remaining.toLocaleString()}</td>
                              <td className="py-1.5 pr-4 text-right text-orange-600">{m.fine > 0 ? `PKR ${m.fine.toLocaleString()}` : "—"}</td>
                              <td className="py-1.5 text-right font-semibold text-red-700">PKR {(m.remaining + m.fine).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="border-t pt-4 flex justify-end">
              <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-3 text-right">
                <p className="text-sm text-gray-500">Grand Total Arrears</p>
                <p className="text-2xl font-bold text-red-700">PKR {grandTotal.toLocaleString()}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
