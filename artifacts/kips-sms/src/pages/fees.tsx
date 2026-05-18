import { useState } from "react";
import { useListFees, useCreateFee, usePayFee, useListStudents, getListFeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, CheckCircle, Clock, AlertCircle, Printer, Pencil, Trash2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import type { FeeRecord } from "@workspace/api-client-react";

const NAVY = "#1a2a5e";

const statusConfig = {
  paid:    { icon: CheckCircle, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  unpaid:  { icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-200"             },
  partial: { icon: Clock,       className: "bg-amber-100 text-amber-700 border-amber-200"        },
};

// ── Schemas ──────────────────────────────────────────────────────────────────
const addFeeSchema = z.object({
  studentId: z.string().min(1, "Student required"),
  amount:    z.string().min(1, "Amount required"),
  month:     z.string().min(1, "Month required"),
  dueDate:   z.string().min(1, "Due date required"),
  fine:      z.string().optional(),
});

const editFeeSchema = z.object({
  amount:  z.string().min(1, "Amount required"),
  month:   z.string().min(1, "Month required"),
  dueDate: z.string().min(1, "Due date required"),
  fine:    z.string().optional(),
});

// ── Receipt interface ────────────────────────────────────────────────────────
interface Receipt {
  receiptNo:       string;
  studentName:     string;
  admissionNumber: string;
  className:       string;
  month:           string;
  amountPaid:      number;
  remaining:       number;
  newStatus:       string;
  paidDate:        string;
}

// ── Direct API helpers (PUT / DELETE not in generated client) ────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("kips_token");
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Request failed");
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// ── Print receipt HTML ───────────────────────────────────────────────────────
function buildReceiptHtml(receipt: Receipt, logoSrc: string): string {
  const copyHtml = (copyLabel: string) => `
    <div class="receipt">
      <div class="copy-label">${copyLabel}</div>
      <div class="header">
        <img src="${logoSrc}" alt="KIPS" />
        <div>
          <div class="school-name">KIPS School Hassari</div>
          <div class="subtitle">Fee Receipt</div>
        </div>
      </div>
      <div class="row-meta"><span class="label">Receipt No.</span><span class="mono">${receipt.receiptNo}</span></div>
      <div class="row-meta"><span class="label">Date</span><span>${receipt.paidDate}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="label">Student</span><span class="val">${receipt.studentName}</span></div>
      <div class="row"><span class="label">Adm. No.</span><span class="adm">${receipt.admissionNumber}</span></div>
      <div class="row"><span class="label">Class</span><span class="val">${receipt.className}</span></div>
      <div class="row"><span class="label">Month</span><span class="val">${receipt.month}</span></div>
      <div class="divider"></div>
      <div class="row amount-row">
        <span class="label green">Amount Paid</span>
        <span class="green bold">PKR ${receipt.amountPaid.toLocaleString()}</span>
      </div>
      ${receipt.remaining > 0
        ? `<div class="row"><span class="label red">Remaining Balance</span><span class="red bold">PKR ${receipt.remaining.toLocaleString()}</span></div>`
        : `<div class="row"><span class="label green">Status</span><span class="green bold">✓ FULLY PAID</span></div>`}
      <div class="divider"></div>
      <div class="approved-row"><span class="approved-text">✦ Approved by Admin ✦</span></div>
      <div class="footer">
        <span>Cashier: ________________</span>
        <span class="muted">Thank you for your payment</span>
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fee Receipt</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:20px;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .page{max-width:420px;margin:0 auto}
  .receipt{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;position:relative}
  .copy-label{position:absolute;top:12px;right:14px;background:#1a2a5e;color:#fff;font-size:9px;font-weight:700;
    letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:20px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:2px solid #1a2a5e;margin-bottom:12px}
  .header img{width:52px;height:52px;border-radius:50%;border:2px solid #e07b1a;object-fit:cover}
  .school-name{font-size:16px;font-weight:700;color:#1a2a5e}
  .subtitle{font-size:11px;color:#9ca3af;margin-top:2px}
  .row-meta{display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-bottom:5px}
  .mono{font-family:monospace;font-weight:700;color:#1f2937;font-size:12px}
  .divider{border-top:1px solid #e5e7eb;margin:10px 0}
  .row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}
  .label{color:#6b7280}.val{color:#111827;font-weight:500}.adm{font-family:monospace;color:#7c3aed;font-weight:600}
  .green{color:#059669!important}.red{color:#dc2626!important}.bold{font-weight:700}
  .amount-row{font-size:14px}
  .approved-row{text-align:center;margin:6px 0 4px}
  .approved-text{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;color:#1a2a5e;
    background:#eef2ff;border:1px solid #c7d2fe;border-radius:20px;padding:3px 14px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer{display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-top:4px}
  .muted{color:#d1d5db}
  .cut-line{text-align:center;font-size:10px;color:#d1d5db;border-top:1px dashed #d1d5db;
    padding-top:6px;margin-bottom:6px;letter-spacing:2px}
  @media print{body{background:#fff;padding:0}
    .receipt{border-radius:0;border:none;border-bottom:1px solid #e5e7eb;margin-bottom:8px}}
</style></head>
<body><div class="page">
  ${copyHtml("School Copy")}
  <div class="cut-line">✂ &nbsp; CUT HERE &nbsp; ✂</div>
  ${copyHtml("Student Copy")}
</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
export default function Fees() {
  const [addOpen, setAddOpen]             = useState(false);
  const [payOpen, setPayOpen]             = useState<number | null>(null);
  const [editFee, setEditFee]             = useState<FeeRecord | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<FeeRecord | null>(null);
  const [deletingId, setDeletingId]       = useState<number | null>(null);
  const [editSaving, setEditSaving]       = useState(false);
  const [payAmount, setPayAmount]         = useState("");
  const [statusFilter, setStatusFilter]   = useState<string | undefined>();
  const [receipt, setReceipt]             = useState<Receipt | null>(null);

  const { toast }    = useToast();
  const queryClient  = useQueryClient();
  const { user }     = useAuthStore();
  const isAdmin      = user?.role === "admin";
  const isStudent    = user?.role === "student";

  const { data: fees, isLoading } = useListFees(
    statusFilter ? { status: statusFilter as "paid" | "unpaid" | "partial" } : {}
  );
  const { data: students } = useListStudents({});
  const createMutation     = useCreateFee();
  const payMutation        = usePayFee();
  const currentFee         = fees?.find(f => f.id === payOpen);

  // ── Add Fee form ──────────────────────────────────────────────────────────
  const addForm = useForm<z.infer<typeof addFeeSchema>>({
    resolver: zodResolver(addFeeSchema),
    defaultValues: { fine: "0" },
  });

  const onAddSubmit = (values: z.infer<typeof addFeeSchema>) => {
    createMutation.mutate({
      data: {
        studentId: Number(values.studentId),
        amount:    Number(values.amount),
        month:     values.month,
        dueDate:   values.dueDate,
        fine:      Number(values.fine ?? 0),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        toast({ title: "Fee record created" });
        setAddOpen(false);
        addForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create fee record" }),
    });
  };

  // ── Edit Fee form ─────────────────────────────────────────────────────────
  const editForm = useForm<z.infer<typeof editFeeSchema>>({
    resolver: zodResolver(editFeeSchema),
  });

  const openEdit = (fee: FeeRecord) => {
    setEditFee(fee);
    editForm.reset({
      amount:  String(fee.amount),
      month:   fee.month,
      dueDate: fee.dueDate,
      fine:    String(fee.fine ?? 0),
    });
  };

  const onEditSubmit = async (values: z.infer<typeof editFeeSchema>) => {
    if (!editFee) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/fees/${editFee.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount:  Number(values.amount),
          month:   values.month,
          dueDate: values.dueDate,
          fine:    Number(values.fine ?? 0),
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      toast({ title: "Fee record updated" });
      setEditFee(null);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete Fee ────────────────────────────────────────────────────────────
  const handleDelete = async (fee: FeeRecord) => {
    setDeletingId(fee.id);
    try {
      await apiFetch(`/api/fees/${fee.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      toast({ title: "Fee record deleted" });
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Pay Fee ───────────────────────────────────────────────────────────────
  const handlePay = () => {
    if (!payOpen || !payAmount || !currentFee) return;
    const paid = Number(payAmount);
    payMutation.mutate({ id: payOpen, data: { paidAmount: paid } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        const totalPaid = (currentFee.paidAmount ?? 0) + paid;
        const remaining = currentFee.amount - totalPaid;
        setReceipt({
          receiptNo:       `RCP-${Date.now().toString().slice(-6)}`,
          studentName:     currentFee.studentName ?? "—",
          admissionNumber: currentFee.admissionNumber ?? "—",
          className:       currentFee.className ?? "—",
          month:           currentFee.month,
          amountPaid:      paid,
          remaining:       Math.max(0, remaining),
          newStatus:       remaining <= 0 ? "paid" : "partial",
          paidDate:        new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
        });
        setPayOpen(null);
        setPayAmount("");
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  // ── Print receipt ─────────────────────────────────────────────────────────
  const handlePrintReceipt = () => {
    if (!receipt) return;
    const logoSrc = `${window.location.origin}/kips-logo.jpeg`;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.write(buildReceiptHtml(receipt, logoSrc));
    w.document.close();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage student fees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          {!isStudent && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-600 to-green-600 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Add Fee Record
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Fee Record</DialogTitle></DialogHeader>
                <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <FormField control={addForm.control} name="studentId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Student *</FormLabel>
                        <Select onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {students?.map(s => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.admissionNumber})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="amount" render={({ field }) => (
                      <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" placeholder="2500" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={addForm.control} name="month" render={({ field }) => (
                      <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={addForm.control} name="dueDate" render={({ field }) => (
                      <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={addForm.control} name="fine" render={({ field }) => (
                      <FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>
                    )} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Status Filters ── */}
      <div className="flex gap-2 flex-wrap no-print">
        {[
          { val: undefined, label: "All"     },
          { val: "paid",    label: "Paid"    },
          { val: "unpaid",  label: "Unpaid"  },
          { val: "partial", label: "Partial" },
        ].map(f => (
          <Button key={f.label} size="sm"
            variant={statusFilter === f.val ? "default" : "outline"}
            onClick={() => setStatusFilter(f.val)}
          >{f.label}</Button>
        ))}
      </div>

      {/* ── Print header ── */}
      <div className="hidden print:block mb-4">
        <div className="flex items-center gap-4 border-b pb-4">
          <img src="/kips-logo.jpeg" alt="KIPS" className="w-14 h-14 rounded-full object-cover" />
          <div>
            <h2 className="text-xl font-bold" style={{ color: NAVY }}>KIPS School Hassari</h2>
            <p className="text-sm text-gray-500">Fee Report — {new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}</p>
          </div>
        </div>
      </div>

      {/* ── Fees Table ── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm print:text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {["Student","Adm#","Class","Month","Amount","Paid","Remaining","Fine","Due Date","Status","Actions"].map(h => (
                      <th key={h} className={`text-left py-3 px-3 font-semibold text-gray-600 ${h === "Actions" ? "print:hidden" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fees?.map(fee => {
                    const st = statusConfig[fee.status as keyof typeof statusConfig] || statusConfig.unpaid;
                    return (
                      <tr key={fee.id} className="border-b hover:bg-gray-50">
                        <td className="py-2.5 px-3 font-medium text-gray-900">{fee.studentName || "—"}</td>
                        <td className="py-2.5 px-3 text-xs font-mono text-purple-600">{fee.admissionNumber || "—"}</td>
                        <td className="py-2.5 px-3 text-gray-600">{fee.className || "—"}</td>
                        <td className="py-2.5 px-3 text-gray-600">{fee.month}</td>
                        <td className="py-2.5 px-3 font-medium">PKR {fee.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-emerald-600">PKR {(fee.paidAmount ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-semibold text-red-600">PKR {(fee.remainingAmount ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-orange-600">{(fee.fine ?? 0) > 0 ? `PKR ${(fee.fine ?? 0).toLocaleString()}` : "—"}</td>
                        <td className="py-2.5 px-3 text-gray-500">{fee.dueDate}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.className}`}>{fee.status}</span>
                        </td>
                        <td className="py-2.5 px-3 print:hidden">
                          <div className="flex gap-1 items-center">
                            {/* Pay button */}
                            {!isStudent && fee.status !== "paid" && (
                              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                                onClick={() => { setPayOpen(fee.id); setPayAmount(String(fee.remainingAmount ?? 0)); }}
                              >Pay</Button>
                            )}
                            {/* Edit button — admin only */}
                            {isAdmin && (
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                                title="Edit fee"
                                onClick={() => openEdit(fee)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {/* Delete button — admin only */}
                            {isAdmin && (
                              <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                title="Delete fee"
                                onClick={() => setDeleteTarget(fee)}
                                disabled={deletingId === fee.id}
                              >
                                {deletingId === fee.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pay Dialog ── */}
      <Dialog open={!!payOpen} onOpenChange={() => { setPayOpen(null); setPayAmount(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {currentFee && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Student:</span><span className="font-medium">{currentFee.studentName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Month:</span><span>{currentFee.month}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Fee:</span><span className="font-medium">PKR {currentFee.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Already Paid:</span><span className="text-emerald-600">PKR {(currentFee.paidAmount ?? 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-gray-700">Remaining:</span><span className="text-red-600">PKR {(currentFee.remainingAmount ?? 0).toLocaleString()}</span></div>
                {(currentFee.fine ?? 0) > 0 && (
                  <div className="flex justify-between"><span className="text-gray-500">Fine:</span><span className="text-orange-600">PKR {(currentFee.fine ?? 0).toLocaleString()}</span></div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount to Pay Now (PKR)</label>
                <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="mt-1" placeholder="Enter amount" max={currentFee.remainingAmount ?? currentFee.amount} />
                {payAmount && Number(payAmount) < (currentFee.remainingAmount ?? 0) && (
                  <p className="text-xs text-amber-600 mt-1">
                    Partial payment — PKR {((currentFee.remainingAmount ?? 0) - Number(payAmount)).toLocaleString()} will remain
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button>
                <Button onClick={handlePay} disabled={payMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {payMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Confirm Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog (Admin only) ── */}
      <Dialog open={!!editFee} onOpenChange={() => setEditFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> Edit Fee Record
            </DialogTitle>
          </DialogHeader>
          {editFee && (
            <div>
              <p className="text-sm text-gray-500 mb-4">
                Student: <strong className="text-gray-800">{editFee.studentName}</strong>
              </p>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                  <FormField control={editForm.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="month" render={({ field }) => (
                    <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="dueDate" render={({ field }) => (
                    <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="fine" render={({ field }) => (
                    <FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditFee(null)}>Cancel</Button>
                    <Button type="submit" disabled={editSaving} style={{ background: NAVY, color: "#fff" }}>
                      {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog (Admin only) ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Fee Record Delete Karein?
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Student:</span><span className="font-semibold">{deleteTarget.studentName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Month:</span><span>{deleteTarget.month}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount:</span><span className="font-semibold text-red-600">PKR {deleteTarget.amount.toLocaleString()}</span></div>
              </div>
              <p className="text-sm text-gray-500">Yeh record hamesha ke liye delete ho jayega — wapas nahi ayega.</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={!!deletingId}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Haan, Delete Karein
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ── */}
      <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
          {receipt && (
            <div>
              <div className="border rounded-xl p-5 bg-white text-sm space-y-3">
                <div className="flex items-center gap-3 border-b pb-3">
                  <img src="/kips-logo.jpeg" alt="KIPS" className="w-12 h-12 rounded-full object-cover border-2" style={{ borderColor: "#e07b1a" }} />
                  <div>
                    <p className="font-bold text-base" style={{ color: NAVY }}>KIPS School Hassari</p>
                    <p className="text-xs text-gray-400">Fee Receipt</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Receipt No.</span><span className="font-mono font-semibold text-gray-800">{receipt.receiptNo}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Date</span><span className="text-gray-700">{receipt.paidDate}</span>
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Student</span><span className="font-medium text-gray-900">{receipt.studentName}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Adm. No.</span><span className="font-mono text-purple-600">{receipt.admissionNumber}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Class</span><span className="text-gray-700">{receipt.className}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">Month</span><span className="text-gray-700">{receipt.month}</span></div>
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm font-semibold text-emerald-600">
                    <span>Amount Paid</span><span>PKR {receipt.amountPaid.toLocaleString()}</span>
                  </div>
                  {receipt.remaining > 0 ? (
                    <div className="flex justify-between text-sm font-semibold text-red-600">
                      <span>Remaining Balance</span><span>PKR {receipt.remaining.toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm font-semibold text-emerald-600">
                      <span>Status</span><span>✓ FULLY PAID</span>
                    </div>
                  )}
                </div>
                <div className="border-t pt-3 text-center space-y-2">
                  <div>
                    <span className="inline-block text-[10px] font-bold tracking-widest px-4 py-1 rounded-full border"
                      style={{ color: NAVY, background: "#eef2ff", borderColor: "#c7d2fe" }}>
                      ✦ Approved by Admin ✦
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Cashier: ________________</p>
                  <p className="text-[10px] text-gray-300">Thank you for your payment</p>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1" onClick={() => setReceipt(null)}>Close</Button>
                <Button className="flex-1" style={{ background: NAVY, color: "#fff" }} onClick={handlePrintReceipt}>
                  <Printer className="w-4 h-4 mr-2" /> Print 2 Copies
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
