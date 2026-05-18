import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useListCertificates, useCreateCertificate,
  useListStudents, getListCertificatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Award, Printer, X } from "lucide-react";

// @page margin:0 removes browser URL / date headers & footers
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

const printDate = new Date().toLocaleDateString("en-PK", {
  day: "numeric", month: "long", year: "numeric",
});

const certTypes = {
  leaving:      { label: "School Leaving Certificate", color: "from-blue-500 to-cyan-500",      hex: "#0369a1" },
  birth:        { label: "Birth Certificate",           color: "from-purple-500 to-indigo-500",  hex: "#6d28d9" },
  bonafide:     { label: "Bonafide Certificate",        color: "from-emerald-500 to-green-500",  hex: "#065f46" },
  character:    { label: "Character Certificate",       color: "from-amber-500 to-orange-500",   hex: "#b45309" },
  result:       { label: "Result Card",                 color: "from-violet-500 to-fuchsia-500", hex: "#7c3aed" },
  fee_clearance:{ label: "Fee Clearance Certificate",   color: "from-teal-500 to-emerald-600",   hex: "#0f766e" },
};

const schema = z.object({
  studentId:  z.string().min(1, "Student required"),
  type:       z.enum(["leaving", "birth", "bonafide", "character", "result", "fee_clearance"]),
  issuedDate: z.string().min(1, "Date required"),
  remarks:    z.string().optional(),
});

type Cert = {
  id:                number;
  type:              string;
  studentName?:      string | null;
  certificateNumber?:string | null;
  issuedDate?:       string | null;
  remarks?:          string | null;
  studentClass?:     string | null;
  admissionNumber?:  string | null;
};

// ─── Individual Certificate Print (opens in new window) ────────────────────
function printSingleCertificate(cert: Cert) {
  const ct = certTypes[cert.type as keyof typeof certTypes] ?? certTypes.leaving;

  const certBodyText: Record<string, string> = {
    leaving:      `This is to certify that <strong>${cert.studentName || "the above-named student"}</strong> was a bonafide student of this school. They have completed their studies and are hereby granted this School Leaving Certificate.`,
    birth:        `This is to certify that the birth of <strong>${cert.studentName || "the above-named student"}</strong> is recorded in the school register.`,
    bonafide:     `This is to certify that <strong>${cert.studentName || "the above-named student"}</strong> is / was a bonafide student of KIPS School Hassari, Hassari.`,
    character:    `This is to certify that <strong>${cert.studentName || "the above-named student"}</strong> was a student of this school. During their stay, their character and conduct were found to be good. We wish them all the best in their future endeavours.`,
    result:       `This is to certify that the above-named student has appeared in the school examination. The result is recorded in the school register.`,
    fee_clearance:`This is to certify that <strong>${cert.studentName || "the above-named student"}</strong> has cleared all outstanding dues and fees of KIPS School Hassari as of the date of issue.`,
  };

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html>
<html><head>
<title>${ct.label} — ${cert.studentName}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; padding: 18mm 20mm; color: #111; }
  .border-frame { border: 4px double #1e3a8a; padding: 12mm 14mm; min-height: calc(297mm - 36mm); position: relative; }
  .inner-border { border: 1.5px solid #93c5fd; padding: 6mm; min-height: calc(297mm - 48mm - 32mm); }
  .header { text-align: center; padding-bottom: 10px; border-bottom: 2px solid #1e3a8a; margin-bottom: 14px; display: flex; align-items: center; gap: 14px; }
  .header-text { flex: 1; }
  .school-name { font-size: 22px; font-weight: 900; color: #1e3a8a; }
  .school-sub   { font-size: 12px; color: #ea580c; font-weight: 700; margin: 2px 0; }
  .cert-title   { text-align: center; margin: 18px 0; }
  .cert-title h2 { font-size: 20px; font-weight: 900; color: ${ct.hex}; text-transform: uppercase; letter-spacing: 2px; border-bottom: 2px solid ${ct.hex}; display: inline-block; padding-bottom: 4px; }
  .cert-no  { text-align: center; font-size: 10px; color: #6b7280; margin-bottom: 18px; }
  .info-row { display: flex; gap: 12px; margin: 12px 0; background: #f9fafb; padding: 10px 14px; border-radius: 6px; border-left: 4px solid ${ct.hex}; }
  .info-row .label { font-weight: 700; font-size: 11px; color: #374151; min-width: 120px; }
  .info-row .val   { font-size: 11px; color: #111; font-weight: 600; }
  .body-text { font-size: 12px; line-height: 1.7; color: #374151; margin: 20px 0; text-align: justify; }
  .remarks  { font-size: 11px; color: #6b7280; font-style: italic; margin-top: 10px; background: #fef9c3; padding: 8px 12px; border-radius: 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box  { text-align: center; }
  .sig-line { border-top: 1px solid #374151; width: 140px; margin: 0 auto 4px; }
  .sig-label { font-size: 10px; color: #374151; font-weight: 700; }
  .footer { text-align: center; margin-top: 20px; font-size: 8px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .seal { position: absolute; bottom: 28mm; right: 22mm; width: 90px; height: 90px; border: 3px double #1e3a8a; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; color: #1e3a8a; font-size: 8px; font-weight: 700; padding: 6px; opacity: 0.25; }
  @media print { body { padding: 0; } .border-frame { border: 4px double #1e3a8a; min-height: calc(297mm - 0mm); } }
</style>
</head><body>
<div class="border-frame">
  <div class="inner-border">
    <div class="header">
      <img src="/kips-logo.jpeg" alt="KIPS" style="width:70px;height:70px;object-fit:contain;flex-shrink:0;" />
      <div class="header-text">
        <div class="school-name">KIPS School Hassari</div>
        <div class="school-sub">Bright Future — School Portal</div>
        <div style="font-size:9px;color:#6b7280;margin-top:2px;">Hassari, Pakistan</div>
      </div>
    </div>

    <div class="cert-title">
      <h2>${ct.label}</h2>
    </div>
    <div class="cert-no">Certificate No: ${cert.certificateNumber || "—"} &nbsp;|&nbsp; Issued: ${cert.issuedDate || printDate}</div>

    <div class="info-row"><span class="label">Student Name:</span><span class="val">${cert.studentName || "—"}</span></div>
    ${cert.admissionNumber ? `<div class="info-row"><span class="label">Admission No:</span><span class="val">${cert.admissionNumber}</span></div>` : ""}
    ${cert.studentClass ? `<div class="info-row"><span class="label">Class:</span><span class="val">${cert.studentClass}</span></div>` : ""}
    <div class="info-row"><span class="label">Date of Issue:</span><span class="val">${cert.issuedDate || printDate}</span></div>

    <div class="body-text">${certBodyText[cert.type] || certBodyText.bonafide}</div>

    ${cert.remarks ? `<div class="remarks"><strong>Remarks:</strong> ${cert.remarks}</div>` : ""}

    <div class="signatures">
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Class Teacher</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Student Signature</div></div>
      <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Principal / Head</div></div>
    </div>

    <div class="seal">KIPS SCHOOL HASSARI<br/>OFFICIAL SEAL</div>

    <div class="footer">KIPS School Hassari — Bright Future School Management Portal &nbsp;|&nbsp; Printed: ${printDate}</div>
  </div>
</div>
</body></html>`);
  w.document.close();
  w.print();
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Certificates() {
  const [open, setOpen]               = useState(false);
  const [previewCert, setPreviewCert] = useState<Cert | null>(null);
  const { toast }      = useToast();
  const queryClient    = useQueryClient();

  const { data: certificates, isLoading } = useListCertificates({});
  const { data: students }   = useListStudents({});
  const createMutation       = useCreateCertificate();

  useEffect(() => {
    const existing = document.getElementById("kips-print-styles");
    if (existing) existing.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { type: "leaving", issuedDate: new Date().toISOString().split("T")[0] },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({ data: { ...values, studentId: Number(values.studentId) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        toast({ title: "Certificate generated successfully" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to generate certificate" }),
    });
  };

  const certList = certificates ?? [];

  // Print table styles
  const th = { padding: "8px 10px", background: "#fef3c7", color: "#78350f", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #fcd34d" };
  const td  = { padding: "7px 10px", border: "1px solid #e5e7eb", fontSize: 9, color: "#1f2937", background: "#ffffff" };
  const tdA = { ...td, background: "#fffbeb" };

  // ─── PRINT PORTAL (all certificates as a report) ────────────────────────────
  const printPortal = createPortal(
    <div id="kips-print-portal" style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif", background: "white", color: "#111827" }}>

      {/* Letterhead */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 75, height: 75, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#1e3a8a" }}>KIPS School Hassari</h1>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#ea580c", fontWeight: 700 }}>Bright Future — School Portal</p>
          <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7280" }}>Certificate Records Report</p>
          <p style={{ margin: "2px 0 0", fontSize: 9, color: "#9ca3af" }}>Printed: {printDate}</p>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#92400e" }}>Certificate Records</h2>
        <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7280" }}>All generated student certificates</p>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {Object.entries(certTypes).map(([key, ct]) => {
          const count = certList.filter(c => c.type === key).length;
          return (
            <div key={key} style={{ flex: "1 1 0", border: `2px solid ${ct.hex}`, borderRadius: 7, padding: "9px 7px", textAlign: "center", background: "#f9fafb" }}>
              <p style={{ margin: 0, fontSize: 7, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{ct.label.replace(" Certificate", "").replace(" Card", "")}</p>
              <p style={{ margin: "5px 0 0", fontSize: 15, fontWeight: 900, color: ct.hex }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Section heading */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 4, height: 18, background: "#b45309", borderRadius: 2 }} />
        <h3 style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#78350f", textTransform: "uppercase", letterSpacing: 0.7 }}>
          All Certificates — {certList.length} Records
        </h3>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["#","Cert No.","Student Name","Class","Type","Issued Date","Remarks"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {!certList.length
            ? <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No certificates generated yet</td></tr>
            : certList.map((cert, i) => {
              const ct = certTypes[cert.type as keyof typeof certTypes] ?? certTypes.leaving;
              return (
                <tr key={cert.id}>
                  <td style={i % 2 === 0 ? td : tdA}>{i + 1}</td>
                  <td style={{ ...(i % 2 === 0 ? td : tdA), fontFamily: "monospace", fontSize: 8, color: "#7c3aed" }}>{cert.certificateNumber || "—"}</td>
                  <td style={{ ...(i % 2 === 0 ? td : tdA), fontWeight: 700 }}>{cert.studentName || "—"}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{(cert as unknown as Cert).studentClass || "—"}</td>
                  <td style={{ ...(i % 2 === 0 ? td : tdA), color: ct.hex, fontWeight: 700 }}>{ct.label}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{cert.issuedDate || "—"}</td>
                  <td style={{ ...(i % 2 === 0 ? td : tdA), color: "#6b7280", fontStyle: "italic" }}>{cert.remarks || "—"}</td>
                </tr>
              );
            })
          }
        </tbody>
        {certList.length > 0 && (
          <tfoot>
            <tr style={{ background: "#fef3c7" }}>
              <td colSpan={6} style={{ ...th, fontWeight: 900 }}>Total Certificates Issued</td>
              <td style={{ ...th, color: "#78350f", fontWeight: 900 }}>{certList.length}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 24, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 7, color: "#9ca3af" }}>KIPS School Hassari — Bright Future School Management Portal</p>
        <p style={{ margin: 0, fontSize: 7, color: "#9ca3af" }}>Generated: {printDate}</p>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {printPortal}

      {/* ── Individual Certificate Preview Modal ──────────────────────────── */}
      {previewCert && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                {certTypes[previewCert.type as keyof typeof certTypes]?.label ?? previewCert.type}
              </h2>
              <Button size="icon" variant="ghost" onClick={() => setPreviewCert(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-6 space-y-3 text-sm text-gray-700">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Student", value: previewCert.studentName },
                  { label: "Cert No.", value: previewCert.certificateNumber },
                  { label: "Issued Date", value: previewCert.issuedDate },
                  { label: "Class", value: (previewCert as unknown as { studentClass?: string }).studentClass },
                ].map(r => (
                  <div key={r.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{r.label}</p>
                    <p className="font-semibold text-gray-900 mt-0.5">{r.value || "—"}</p>
                  </div>
                ))}
              </div>
              {previewCert.remarks && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-xs">
                  <strong>Remarks:</strong> {previewCert.remarks}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <Button variant="outline" onClick={() => setPreviewCert(null)}>Close</Button>
              <Button
                onClick={() => { printSingleCertificate(previewCert); }}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white"
              >
                <Printer className="w-4 h-4 mr-2" /> Print Certificate
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
            <p className="text-gray-500 text-sm mt-1">Generate and manage student certificates</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> Print All Records
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white" data-testid="button-generate-certificate">
                  <Plus className="w-4 h-4 mr-2" /> Generate Certificate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Generate Certificate</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="studentId" render={({ field }) => (
                      <FormItem><FormLabel>Student *</FormLabel>
                        <Select onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {students?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.admissionNumber})</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem><FormLabel>Certificate Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.entries(certTypes).map(([val, ct]) => <SelectItem key={val} value={val}>{ct.label}</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="issuedDate" render={({ field }) => (
                      <FormItem><FormLabel>Issued Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="remarks" render={({ field }) => (
                      <FormItem><FormLabel>Remarks</FormLabel><FormControl><Input placeholder="Optional remarks..." {...field} /></FormControl></FormItem>
                    )} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Generate
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary pills */}
        {!isLoading && certList.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(certTypes).map(([key, ct]) => {
              const count = certList.filter(c => c.type === key).length;
              if (!count) return null;
              return (
                <span key={key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${ct.color} text-white shadow-sm`}>
                  <Award className="w-3 h-3" /> {ct.label}: {count}
                </span>
              );
            })}
          </div>
        )}

        {/* Cards grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {!certList.length ? (
              <div className="col-span-full text-center py-16 text-gray-500">No certificates generated yet</div>
            ) : certList.map(cert => {
              const ct = certTypes[cert.type as keyof typeof certTypes] || certTypes.leaving;
              return (
                <Card key={cert.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-cert-${cert.id}`} onClick={() => setPreviewCert(cert as unknown as Cert)}>
                  <div className={`h-1.5 bg-gradient-to-r ${ct.color}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ct.color} flex items-center justify-center shadow-sm`}>
                        <Award className="w-5 h-5 text-white" />
                      </div>
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7"
                        onClick={e => { e.stopPropagation(); printSingleCertificate(cert as unknown as Cert); }}
                        data-testid={`button-print-cert-${cert.id}`}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">{ct.label}</h3>
                    <p className="text-gray-600 text-sm mt-1">{cert.studentName || "—"}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span className="font-mono">{cert.certificateNumber}</span>
                      <span>{cert.issuedDate}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
