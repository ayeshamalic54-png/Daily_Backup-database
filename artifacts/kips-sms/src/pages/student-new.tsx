import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateStudent, useListClasses, useCreateFee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, User, Camera } from "lucide-react";

const schema = z.object({
  name:             z.string().min(2, "Name required"),
  fatherName:       z.string().optional(),
  motherName:       z.string().optional(),
  dateOfBirth:      z.string().optional(),
  gender:           z.enum(["male", "female"]).optional(),
  address:          z.string().optional(),
  phone:            z.string().optional(),
  emergencyContact: z.string().optional(),
  classId:          z.string().min(1, "Class required"),
  section:          z.string().optional(),
  rollNumber:       z.string().optional(),
  feeAmount:        z.string().optional(),
  siblingDiscount:  z.string().optional(),
  status:           z.enum(["active", "inactive", "left"]).default("active"),
});

function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Admission Receipt ─────────────────────────────────────────────────────────
interface AdmissionData {
  admissionNumber: string;
  studentName:     string;
  fatherName:      string;
  className:       string;
  section:         string;
  rollNumber:      string;
  admissionDate:   string;
  monthlyFee:      number;
  admissionFee:    number;
  siblingDiscount: number;
  phone:           string;
  address:         string;
}

function buildAdmissionReceiptHtml(d: AdmissionData, logoSrc: string): string {
  const totalDue = d.admissionFee + Math.max(0, d.monthlyFee - d.siblingDiscount);
  const copy = (label: string, accent: string) => `
    <div class="slip" style="--accent:${accent}">
      <div class="ribbon" style="background:${accent}">${label}</div>
      <div class="header">
        <img src="${logoSrc}" alt="KIPS" />
        <div class="head-text">
          <div class="school">KIPS School Hassari</div>
          <div class="tag">Bright Future — Quality Education</div>
          <div class="title">ADMISSION SLIP</div>
        </div>
      </div>

      <div class="meta">
        <div class="meta-cell"><span class="ml">Admission No.</span><span class="mv mono">${d.admissionNumber}</span></div>
        <div class="meta-cell"><span class="ml">Date</span><span class="mv">${d.admissionDate}</span></div>
      </div>

      <div class="card">
        <div class="card-title">STUDENT DETAILS</div>
        <div class="row"><span class="k">Full Name</span><span class="v strong">${d.studentName}</span></div>
        <div class="row"><span class="k">Father's Name</span><span class="v">${d.fatherName || "—"}</span></div>
        <div class="row"><span class="k">Class</span><span class="v strong">${d.className}${d.section ? " — " + d.section : ""}</span></div>
        <div class="row"><span class="k">Roll Number</span><span class="v">${d.rollNumber || "—"}</span></div>
        <div class="row"><span class="k">Phone</span><span class="v">${d.phone || "—"}</span></div>
        <div class="row"><span class="k">Address</span><span class="v small">${d.address || "—"}</span></div>
      </div>

      <div class="card fee-card">
        <div class="card-title">FEE BREAKDOWN</div>
        <div class="row"><span class="k">Admission Fee (one-time)</span><span class="v strong">PKR ${d.admissionFee.toLocaleString()}</span></div>
        <div class="row"><span class="k">Monthly Fee</span><span class="v">PKR ${d.monthlyFee.toLocaleString()}</span></div>
        ${d.siblingDiscount > 0
          ? `<div class="row"><span class="k discount">Sibling Discount</span><span class="v discount">− PKR ${d.siblingDiscount.toLocaleString()}</span></div>`
          : ""}
        <div class="row total-row">
          <span class="k strong">First Payment Due</span>
          <span class="v total">PKR ${totalDue.toLocaleString()}</span>
        </div>
      </div>

      <div class="sigs">
        <div class="sig"><div class="line"></div><div class="lbl">Parent / Guardian Signature</div></div>
        <div class="seal">SCHOOL<br/>STAMP</div>
        <div class="sig"><div class="line"></div><div class="lbl">Principal Signature</div></div>
      </div>

      <div class="footer">
        <span class="ft-text">Welcome to KIPS School Hassari Family</span>
        <span class="ft-mono">Login: ${d.studentName.toLowerCase().replace(/\s+/g, ".")}.${d.admissionNumber.split("-").pop()} / kips123</span>
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Admission Slip — ${d.studentName}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 8mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;background:#f1f5f9;padding:14px;color:#0f172a;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .page{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
  .slip{background:#fff;border:2px solid var(--accent);border-radius:14px;padding:16px 18px;position:relative;overflow:hidden;
    box-shadow:0 4px 18px rgba(15,23,42,0.08)}
  .slip::before{content:"";position:absolute;top:0;left:0;right:0;height:6px;
    background:linear-gradient(90deg,var(--accent),#e07b1a);
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .ribbon{position:absolute;top:14px;right:-32px;color:#fff;font-size:10px;font-weight:800;letter-spacing:2px;
    padding:3px 36px;transform:rotate(35deg);text-transform:uppercase;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header{display:flex;align-items:center;gap:14px;padding:8px 0 12px;border-bottom:2px dashed #cbd5e1;margin-bottom:12px}
  .header img{width:60px;height:60px;border-radius:50%;border:3px solid #e07b1a;object-fit:cover;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .school{font-size:18px;font-weight:800;color:var(--accent)}
  .tag{font-size:10px;color:#64748b;margin-top:1px;font-style:italic}
  .title{display:inline-block;margin-top:4px;font-size:9px;font-weight:700;letter-spacing:2px;
    background:linear-gradient(135deg,var(--accent),#3730a3);color:#fff;padding:3px 12px;border-radius:12px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
  .meta-cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;
    display:flex;justify-content:space-between;align-items:center}
  .ml{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .mv{font-size:12px;color:#0f172a;font-weight:700}
  .mono{font-family:'Courier New',monospace;color:#7c3aed}
  .card{background:linear-gradient(135deg,#f8fafc,#eef2ff);border:1px solid #e0e7ff;border-radius:10px;
    padding:10px 14px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .fee-card{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fde68a}
  .card-title{font-size:9px;font-weight:800;letter-spacing:2px;color:var(--accent);margin-bottom:6px;padding-bottom:4px;border-bottom:1px dotted #cbd5e1}
  .row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px}
  .k{color:#64748b}.v{color:#0f172a;text-align:right}
  .strong{font-weight:700}.small{font-size:10px}
  .discount{color:#059669!important;font-weight:600}
  .total-row{border-top:1.5px dashed #f59e0b;padding-top:6px;margin-top:4px;font-size:13px}
  .total{color:#dc2626;font-size:15px;font-weight:900}
  .sigs{display:grid;grid-template-columns:1fr 80px 1fr;gap:14px;align-items:end;margin:14px 0 8px}
  .sig{text-align:center}
  .line{border-top:1.5px solid #475569;height:1px;margin-bottom:3px}
  .lbl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .seal{width:80px;height:60px;border:2px dashed var(--accent);border-radius:50%;
    display:flex;align-items:center;justify-content:center;color:var(--accent);
    font-size:8px;font-weight:800;text-align:center;line-height:1.2;letter-spacing:1px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer{display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;
    padding-top:8px;border-top:1px dashed #cbd5e1;flex-wrap:wrap;gap:4px}
  .ft-text{font-style:italic;color:var(--accent);font-weight:600}
  .ft-mono{font-family:'Courier New',monospace;color:#7c3aed;font-size:8px}
  .cut-line{text-align:center;font-size:10px;color:#94a3b8;letter-spacing:4px;padding:2px 0}
  @media print{body{background:#fff;padding:0}.slip{box-shadow:none;page-break-inside:avoid}}
</style></head>
<body><div class="page">
  ${copy("School Copy", "#1a2a5e")}
  <div class="cut-line">✂ &nbsp;━━━━━━━━━━━━━━━ CUT HERE ━━━━━━━━━━━━━━━ &nbsp;✂</div>
  ${copy("Parent Copy", "#7c3aed")}
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`;
}

export default function StudentNew() {
  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const [imagePreview,   setImagePreview]   = useState<string | null>(null);
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: classes } = useListClasses();
  const createMutation    = useCreateStudent();
  const createFeeMutation = useCreateFee();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: z.infer<typeof schema>) => {
    createMutation.mutate(
      {
        data: {
          ...values,
          classId:         Number(values.classId),
          feeAmount:       values.feeAmount       ? Number(values.feeAmount)       : undefined,
          siblingDiscount: values.siblingDiscount ? Number(values.siblingDiscount) : 0,
        },
      },
      {
        onSuccess: async (student) => {
          // Upload image if selected
          if (imageFile && student.id) {
            setUploadingImage(true);
            try {
              const formData = new FormData();
              formData.append("image", imageFile);
              await fetch(`/api/students/${student.id}/image`, {
                method: "POST",
                headers: authHeader() as HeadersInit,
                body: formData,
              });
            } catch {
              toast({ variant: "destructive", title: "Student created but photo upload failed" });
            } finally {
              setUploadingImage(false);
            }
          }

          // Fetch fee structure for admission fee + create admission fee record
          const monthlyFee      = values.feeAmount       ? Number(values.feeAmount)       : 0;
          const siblingDiscount = values.siblingDiscount ? Number(values.siblingDiscount) : 0;
          let   admissionFee   = 0;

          try {
            const fsRes = await fetch("/api/fee-structures", { headers: authHeader() as HeadersInit });
            if (fsRes.ok) {
              const fsList = await fsRes.json();
              const fs = Array.isArray(fsList)
                ? fsList.find((x: any) => Number(x.classId) === Number(values.classId))
                : null;
              if (fs) admissionFee = Number(fs.admissionFee ?? 0);
            }
          } catch { /* non-fatal */ }

          // Save admission fee record to DB (one-time fee)
          if (admissionFee > 0) {
            const today    = new Date();
            const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
            const dueDate  = today.toISOString().slice(0, 10);
            try {
              await createFeeMutation.mutateAsync({
                data: {
                  studentId: student.id,
                  amount:    admissionFee,
                  month:     `Admission-${monthKey}`,
                  dueDate,
                  notes:     "Admission Fee (one-time)",
                } as any,
              });
            } catch { /* non-fatal — continue with receipt */ }
          }

          // Build admission receipt
          const cls = classes?.find((c: any) => c.id === Number(values.classId));
          const admissionDate = new Date().toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric"
          });

          const slipData: AdmissionData = {
            admissionNumber: student.admissionNumber,
            studentName:     values.name,
            fatherName:      values.fatherName || "",
            className:       cls?.name || "—",
            section:         values.section || "",
            rollNumber:      values.rollNumber || "",
            admissionDate,
            monthlyFee,
            admissionFee,
            siblingDiscount,
            phone:           values.phone || "",
            address:         values.address || "",
          };

          // Open print window with 2 admission slip copies
          const logoSrc = `${window.location.origin}/kips-logo.jpeg`;
          const w = window.open("", "_blank", "width=820,height=900");
          if (w) {
            w.document.write(buildAdmissionReceiptHtml(slipData, logoSrc));
            w.document.close();
          }

          queryClient.invalidateQueries({ queryKey: ["listStudents"] });
          queryClient.invalidateQueries({ queryKey: ["listFees"] });
          toast({ title: "Student admitted! Admission slips printing…" });
          setLocation("/students");
        },
        onError: () => toast({ variant: "destructive", title: "Failed to admit student" }),
      }
    );
  };

  const isPending = createMutation.isPending || uploadingImage;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Student Admission</h1>
          <p className="text-gray-500 text-sm mt-0.5">Fill in the details to admit a new student</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Photo Upload ─────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Student Photo</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {/* Preview */}
                <div
                  className="w-28 h-28 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <User className="w-10 h-10 mx-auto mb-1" />
                      <p className="text-xs">No photo</p>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {imagePreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-500 text-sm"
                      onClick={() => { setImagePreview(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    >
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-gray-400">JPG, PNG, WebP — max 5MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleImageChange}
              />
            </CardContent>
          </Card>

          {/* ── Personal Info ─────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl><Input placeholder="Student full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fatherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Father's Name</FormLabel>
                  <FormControl><Input placeholder="Father name" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="motherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mother's Name</FormLabel>
                  <FormControl><Input placeholder="Mother name" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="0300-1234567" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input placeholder="Emergency number" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="Full address" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Academic Info ─────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-base">Academic Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes?.map(cls => (
                        <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <FormControl><Input placeholder="A" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="rollNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Roll Number</FormLabel>
                  <FormControl><Input placeholder="01" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="feeAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Fee (PKR)</FormLabel>
                  <FormControl><Input type="number" placeholder="2500" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="siblingDiscount" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Sibling Discount (PKR)
                    <span className="text-xs text-blue-600 font-normal">(if applicable)</span>
                  </FormLabel>
                  <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                  <p className="text-xs text-gray-500">Monthly discount for students with siblings in school</p>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLocation("/students")}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />
                {uploadingImage ? "Uploading Photo..." : "Saving..."}</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Admit Student</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}