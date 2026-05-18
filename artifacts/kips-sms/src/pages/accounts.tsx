import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useListIncome, useListExpenses, useCreateIncome, useCreateExpense, useGetAccountSummary, useListFees, getListIncomeQueryKey, getListExpensesQueryKey, getGetAccountSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Printer, TrendingUp, TrendingDown, DollarSign, CreditCard } from "lucide-react";

// ─── PRINT CSS ────────────────────────────────────────────────────────────────
// Portal approach: renders print div as direct body child.
// body > * { display:none } hides React root.
// #kips-print-portal is NOT inside React root, so it's visible.
// No blank pages. No font issues.
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

const schema = z.object({
  amount:      z.string().min(1, "Amount required"),
  category:    z.string().min(1, "Category required"),
  description: z.string().min(1, "Description required"),
  date:        z.string().min(1, "Date required"),
});

const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

export default function Accounts() {
  const [tab, setTab]               = useState("summary");
  const [addIncomeOpen, setAddIncomeOpen]   = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { toast }        = useToast();
  const queryClient      = useQueryClient();

  // Inject print styles
  useEffect(() => {
    const existing = document.getElementById("kips-print-styles");
    if (existing) existing.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const { data: summary, isLoading: summaryLoading } = useGetAccountSummary({ month: currentMonth });
  const { data: income,   isLoading: incomeLoading  } = useListIncome({ month: currentMonth });
  const { data: expenses, isLoading: expensesLoading } = useListExpenses({ month: currentMonth });
  const { data: allFees,  isLoading: feesLoading     } = useListFees({});

  const feesPaidThisMonth = (allFees ?? []).filter(
    f => f.paidDate?.startsWith(currentMonth) && (f.paidAmount ?? 0) > 0
  );
  const feeIncomeTotal    = feesPaidThisMonth.reduce((s, f) => s + (f.paidAmount ?? 0), 0);
  const manualIncomeTotal = (income ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalIncomeValue  = feeIncomeTotal + manualIncomeTotal;
  const expensesTotal     = (expenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalExpensesValue = expensesTotal > 0 ? expensesTotal : (summary?.totalExpenses ?? 0);
  const netProfitValue    = totalIncomeValue - totalExpensesValue;
  const isLoadingAny      = summaryLoading || feesLoading || incomeLoading || expensesLoading;

  const createIncome  = useCreateIncome();
  const createExpense = useCreateExpense();

  const incomeForm = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });
  const expenseForm = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().split("T")[0] },
  });

  const onAddIncome = (values: z.infer<typeof schema>) => {
    createIncome.mutate({ data: { ...values, amount: Number(values.amount) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIncomeQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountSummaryQueryKey() });
        toast({ title: "Income recorded" });
        setAddIncomeOpen(false);
        incomeForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to record income" }),
    });
  };

  const onAddExpense = (values: z.infer<typeof schema>) => {
    createExpense.mutate({ data: { ...values, amount: Number(values.amount) } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAccountSummaryQueryKey() });
        toast({ title: "Expense recorded" });
        setAddExpenseOpen(false);
        expenseForm.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to record expense" }),
    });
  };

  const EntryForm = ({
    form, onSubmit, isPending, type,
  }: {
    form: ReturnType<typeof useForm<z.infer<typeof schema>>>;
    onSubmit: (v: z.infer<typeof schema>) => void;
    isPending: boolean;
    type: string;
  }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="amount" render={({ field }) => (
          <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" placeholder="10000" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem><FormLabel>Category *</FormLabel><FormControl><Input placeholder={type === "income" ? "Donations, Canteen..." : "Salaries, Utilities..."} {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description *</FormLabel><FormControl><Input placeholder="Description..." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="date" render={({ field }) => (
          <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
          </Button>
        </div>
      </form>
    </Form>
  );

  const monthLabel = new Date().toLocaleDateString("en-PK", { month: "long", year: "numeric" });

  // ── Print styles shared ──
  const th = (bg: string, color: string) => ({
    padding: "8px 12px", background: bg, color, fontWeight: 700,
    fontSize: 10, textAlign: "left" as const, border: "1px solid #e5e7eb",
  });
  const td  = { padding: "7px 12px", border: "1px solid #e5e7eb", fontSize: 10, color: "#1f2937", background: "#ffffff" };
  const tdA = { ...td, background: "#f9fafb" };

  // ─── PRINT PORTAL ──────────────────────────────────────────────────────────
  const printPortal = createPortal(
    <div
      id="kips-print-portal"
      style={{
        position: "absolute", left: "-99999px", top: "-99999px",
        fontFamily: "Arial, sans-serif", background: "white", color: "#111827",
      }}
    >
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
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>Accounts</h2>
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#6b7280" }}>Income and expense management — {monthLabel}</p>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Fee Income",     value: `PKR ${feeIncomeTotal.toLocaleString()}`,    color: "#1d4ed8" },
          { label: "Other Income",   value: `PKR ${manualIncomeTotal.toLocaleString()}`, color: "#065f46" },
          { label: "Total Expenses", value: `PKR ${totalExpensesValue.toLocaleString()}`,color: "#b91c1c" },
          { label: "Net Profit",     value: `PKR ${netProfitValue.toLocaleString()}`,    color: netProfitValue >= 0 ? "#6d28d9" : "#b91c1c" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 0", border: `2px solid ${c.color}`, borderRadius: 8, padding: "12px 10px", textAlign: "center", background: "#f9fafb" }}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{c.label}</p>
            <p style={{ margin: "7px 0 0", fontSize: 15, fontWeight: 900, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Total Income banner */}
      <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 6, padding: "10px 14px", marginBottom: 22, fontSize: 11, color: "#065f46" }}>
        <strong>Total Income this month: PKR {totalIncomeValue.toLocaleString()}</strong>
        <span style={{ marginLeft: 12, color: "#047857", fontSize: 10 }}>
          (Fee: PKR {feeIncomeTotal.toLocaleString()} + Other: PKR {manualIncomeTotal.toLocaleString()})
        </span>
      </div>

      {/* Fee Collections */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 4, height: 18, background: "#1d4ed8", borderRadius: 2 }} />
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.7 }}>
            Fee Collections — {feesPaidThisMonth.length} Records
          </h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Date Paid","Student Name","Fee Month","Amount (PKR)","Status"].map(h => <th key={h} style={th("#dbeafe","#1e3a8a")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!feesPaidThisMonth.length
              ? <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No fee payments this month</td></tr>
              : feesPaidThisMonth.map((f, i) => (
                <tr key={f.id}>
                  <td style={i % 2 === 0 ? td : tdA}>{f.paidDate ?? "—"}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{(f as Record<string,unknown>).studentName as string ?? `Student #${f.studentId}`}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{f.month}</td>
                  <td style={i % 2 === 0 ? td : tdA}>PKR {(f.paidAmount ?? 0).toLocaleString()}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{f.status}</td>
                </tr>
              ))
            }
          </tbody>
          {feesPaidThisMonth.length > 0 && (
            <tfoot>
              <tr style={{ background: "#dbeafe" }}>
                <td colSpan={3} style={th("#dbeafe","#1e3a8a")}>Total Fee Income</td>
                <td style={{ ...th("#dbeafe","#1d4ed8"), fontWeight: 900 }}>PKR {feeIncomeTotal.toLocaleString()}</td>
                <td style={th("#dbeafe","#1e3a8a")} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Other Income */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 4, height: 18, background: "#065f46", borderRadius: 2 }} />
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.7 }}>
            Other Income — {(income ?? []).length} Records
          </h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Date","Category","Description","Amount (PKR)"].map(h => <th key={h} style={th("#d1fae5","#064e3b")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!(income ?? []).length
              ? <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No other income this month</td></tr>
              : (income ?? []).map((e, i) => (
                <tr key={e.id}>
                  <td style={i % 2 === 0 ? td : tdA}>{e.date}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{e.category}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{e.description}</td>
                  <td style={i % 2 === 0 ? td : tdA}>PKR {e.amount.toLocaleString()}</td>
                </tr>
              ))
            }
          </tbody>
          {(income ?? []).length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={th("#d1fae5","#064e3b")}>Total Other Income</td>
                <td style={{ ...th("#d1fae5","#065f46"), fontWeight: 900 }}>PKR {manualIncomeTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Expenses */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 4, height: 18, background: "#b91c1c", borderRadius: 2 }} />
          <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#b91c1c", textTransform: "uppercase", letterSpacing: 0.7 }}>
            Expenses — {(expenses ?? []).length} Records
          </h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Date","Category","Description","Amount (PKR)"].map(h => <th key={h} style={th("#fee2e2","#7f1d1d")}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!(expenses ?? []).length
              ? <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No expenses this month</td></tr>
              : (expenses ?? []).map((e, i) => (
                <tr key={e.id}>
                  <td style={i % 2 === 0 ? td : tdA}>{e.date}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{e.category}</td>
                  <td style={i % 2 === 0 ? td : tdA}>{e.description}</td>
                  <td style={i % 2 === 0 ? td : tdA}>PKR {e.amount.toLocaleString()}</td>
                </tr>
              ))
            }
          </tbody>
          {(expenses ?? []).length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={th("#fee2e2","#7f1d1d")}>Total Expenses</td>
                <td style={{ ...th("#fee2e2","#b91c1c"), fontWeight: 900 }}>PKR {totalExpensesValue.toLocaleString()}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Net Profit box */}
      <div style={{
        border: `2px solid ${netProfitValue >= 0 ? "#7c3aed" : "#dc2626"}`,
        borderRadius: 8, padding: "14px 20px",
        background: netProfitValue >= 0 ? "#ede9fe" : "#fee2e2",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 12, color: "#1e293b", textTransform: "uppercase" }}>Net Profit</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#6b7280" }}>{monthLabel}</p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#6b7280" }}>
            PKR {feeIncomeTotal.toLocaleString()} fee + PKR {manualIncomeTotal.toLocaleString()} other − PKR {totalExpensesValue.toLocaleString()} expenses
          </p>
        </div>
        <p style={{ margin: 0, fontWeight: 900, fontSize: 28, color: netProfitValue >= 0 ? "#5b21b6" : "#991b1b" }}>
          PKR {netProfitValue.toLocaleString()}
        </p>
      </div>

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
      {/* Print portal (outside React root, direct child of body) */}
      {printPortal}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            <p className="text-gray-500 text-sm mt-1">Income and expense management — {monthLabel}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-accounts">
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Dialog open={addIncomeOpen} onOpenChange={setAddIncomeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" data-testid="button-add-income">
                  <Plus className="w-4 h-4 mr-1" /> Other Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Other Income</DialogTitle></DialogHeader>
                <EntryForm form={incomeForm} onSubmit={onAddIncome} isPending={createIncome.isPending} type="income" />
              </DialogContent>
            </Dialog>
            <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" data-testid="button-add-expense">
                  <Plus className="w-4 h-4 mr-1" /> Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
                <EntryForm form={expenseForm} onSubmit={onAddExpense} isPending={createExpense.isPending} type="expense" />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Fee Income",     value: feeIncomeTotal,    gradient: "from-blue-500 to-cyan-500",    icon: CreditCard,   hint: "From student fee payments"   },
            { label: "Other Income",   value: manualIncomeTotal, gradient: "from-emerald-500 to-green-500",icon: TrendingUp,   hint: "Manually entered income"     },
            { label: "Total Expenses", value: totalExpensesValue,gradient: "from-red-500 to-rose-500",     icon: TrendingDown, hint: "All expenses this month"     },
            { label: "Net Profit",     value: netProfitValue,    gradient: netProfitValue >= 0 ? "from-purple-500 to-indigo-600" : "from-gray-600 to-gray-800", icon: DollarSign, hint: "Fee + Other Income − Expenses" },
          ].map(card => (
            <Card key={card.label} className={`bg-gradient-to-br ${card.gradient} border-0`}>
              <CardContent className="p-5 text-white">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white/80 text-sm font-medium">{card.label}</p>
                  <card.icon className="w-5 h-5 text-white/70" />
                </div>
                <p className="text-white/60 text-xs mb-2">{card.hint}</p>
                {isLoadingAny
                  ? <div className="h-7 bg-white/20 rounded animate-pulse" />
                  : <p className="text-2xl font-bold">PKR {card.value.toLocaleString()}</p>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Total Income banner */}
        <Card className="border border-emerald-200 bg-emerald-50">
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Total Income this month:
              </span>
              {isLoadingAny
                ? <span className="h-5 w-24 bg-emerald-200 rounded animate-pulse inline-block" />
                : <span className="font-bold text-emerald-700 text-base">PKR {totalIncomeValue.toLocaleString()}</span>
              }
              <span className="text-emerald-600 text-xs">
                (Fee Collections: PKR {feeIncomeTotal.toLocaleString()} + Other: PKR {manualIncomeTotal.toLocaleString()})
              </span>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="fees">
          <TabsList>
            <TabsTrigger value="fees">Fee Income</TabsTrigger>
            <TabsTrigger value="income">Other Income</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          {/* Fee Income Tab */}
          <TabsContent value="fees">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" /> Fee Payments Collected — {monthLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {feesLoading ? (
                  <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-blue-50">
                      <tr>{["Date Paid","Student","Month","Paid Amount (PKR)","Status"].map(h => (
                        <th key={h} className="text-left py-3 px-3 font-semibold text-blue-800">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {!feesPaidThisMonth.length
                        ? <tr><td colSpan={5} className="py-8 text-center text-gray-400">No fee payments collected this month</td></tr>
                        : feesPaidThisMonth.map(f => (
                          <tr key={f.id} className="border-b hover:bg-gray-50">
                            <td className="py-2.5 px-3 text-gray-600">{f.paidDate ?? "—"}</td>
                            <td className="py-2.5 px-3 text-gray-700 font-medium">
                              {(f as Record<string,unknown>).studentName as string ?? `Student #${f.studentId}`}
                            </td>
                            <td className="py-2.5 px-3 text-gray-600">{f.month}</td>
                            <td className="py-2.5 px-3 font-bold text-blue-600">PKR {(f.paidAmount ?? 0).toLocaleString()}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                f.status === "paid"    ? "bg-emerald-100 text-emerald-700" :
                                f.status === "partial" ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"}`}>
                                {f.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                    {feesPaidThisMonth.length > 0 && (
                      <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 font-semibold text-blue-800">Total Fee Income</td>
                          <td className="py-2.5 px-3 font-bold text-blue-700">PKR {feeIncomeTotal.toLocaleString()}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Other Income Tab */}
          <TabsContent value="income">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Other Income (Manually Entered) — {monthLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {incomeLoading ? (
                  <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-emerald-50">
                      <tr>{["Date","Category","Description","Amount (PKR)"].map(h => (
                        <th key={h} className="text-left py-3 px-3 font-semibold text-emerald-800">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {!income?.length
                        ? <tr><td colSpan={4} className="py-8 text-center text-gray-400">No other income records this month</td></tr>
                        : income?.map(entry => (
                          <tr key={entry.id} className="border-b hover:bg-gray-50" data-testid={`row-income-${entry.id}`}>
                            <td className="py-2.5 px-3 text-gray-600">{entry.date}</td>
                            <td className="py-2.5 px-3 text-gray-700">{entry.category}</td>
                            <td className="py-2.5 px-3 text-gray-600">{entry.description}</td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">PKR {entry.amount.toLocaleString()}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                    {(income?.length ?? 0) > 0 && (
                      <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 font-semibold text-emerald-800">Total Other Income</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-700">PKR {manualIncomeTotal.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" /> Expenses — {monthLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {expensesLoading ? (
                  <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-red-50">
                      <tr>{["Date","Category","Description","Amount (PKR)"].map(h => (
                        <th key={h} className="text-left py-3 px-3 font-semibold text-red-800">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {!expenses?.length
                        ? <tr><td colSpan={4} className="py-8 text-center text-gray-400">No expense records this month</td></tr>
                        : expenses?.map(entry => (
                          <tr key={entry.id} className="border-b hover:bg-gray-50" data-testid={`row-expense-${entry.id}`}>
                            <td className="py-2.5 px-3 text-gray-600">{entry.date}</td>
                            <td className="py-2.5 px-3 text-gray-700">{entry.category}</td>
                            <td className="py-2.5 px-3 text-gray-600">{entry.description}</td>
                            <td className="py-2.5 px-3 font-bold text-red-600">PKR {entry.amount.toLocaleString()}</td>
                          </tr>
                        ))
                      }
                    </tbody>
                    {(expenses?.length ?? 0) > 0 && (
                      <tfoot className="bg-red-50 border-t-2 border-red-200">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 font-semibold text-red-800">Total Expenses</td>
                          <td className="py-2.5 px-3 font-bold text-red-700">PKR {totalExpensesValue.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
