// ============================================================
// FILE PATH: artifacts/api-server/src/routes/dashboard.ts
// TASK 7: Monthly expenses mein salary bhi shamil hai
// ============================================================
import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  staffTable,
  classesTable,
  feesTable,
  accountEntriesTable,
  salariesTable,
} from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const today        = new Date().toISOString().slice(0, 10);       // "2026-05-18"
    const currentMonth = new Date().toISOString().slice(0, 7);        // "2026-05"

    // ── Student counts ──────────────────────────────────────────────────────
    const [{ totalStudents }] = await db
      .select({ totalStudents: sql<number>`count(*)` })
      .from(studentsTable);

    const [{ activeStudents }] = await db
      .select({ activeStudents: sql<number>`count(*)` })
      .from(studentsTable)
      .where(eq(studentsTable.status, "active"));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const [{ recentAdmissions }] = await db
      .select({ recentAdmissions: sql<number>`count(*)` })
      .from(studentsTable)
      .where(sql`${studentsTable.createdAt} >= ${thirtyDaysAgo}`);

    const [{ defaulterCount }] = await db
      .select({ defaulterCount: sql<number>`count(distinct ${feesTable.studentId})` })
      .from(feesTable)
      .where(sql`${feesTable.status} in ('unpaid','partial')`);

    // ── Staff counts ────────────────────────────────────────────────────────
    const [{ totalTeachers }] = await db
      .select({ totalTeachers: sql<number>`count(*)` })
      .from(staffTable)
      .where(and(eq(staffTable.role, "teacher"), eq(staffTable.status, "active")));

    // ── Class count ─────────────────────────────────────────────────────────
    const [{ totalClasses }] = await db
      .select({ totalClasses: sql<number>`count(*)` })
      .from(classesTable);

    // ── Fee income ──────────────────────────────────────────────────────────
    const todayFees = await db
      .select({ paidAmount: feesTable.paidAmount })
      .from(feesTable)
      .where(eq(feesTable.paidDate, today));
    const todayFeeIncome = todayFees.reduce((s, f) => s + Number(f.paidAmount ?? 0), 0);

    const monthFees = await db
      .select({ paidAmount: feesTable.paidAmount })
      .from(feesTable)
      .where(like(feesTable.paidDate, `${currentMonth}%`));
    const monthFeeIncome = monthFees.reduce((s, f) => s + Number(f.paidAmount ?? 0), 0);

    // Pending fees (amount - paid_amount = remaining)
    const unpaidFees = await db
      .select({ amount: feesTable.amount, paidAmount: feesTable.paidAmount })
      .from(feesTable)
      .where(sql`${feesTable.status} in ('unpaid','partial')`);
    const pendingFees = unpaidFees.reduce((s, f) => s + Math.max(0, Number(f.amount ?? 0) - Number(f.paidAmount ?? 0)), 0);

    // ── Account entries (manual income / expense) ───────────────────────────
    const todayEntries = await db
      .select({ type: accountEntriesTable.type, amount: accountEntriesTable.amount })
      .from(accountEntriesTable)
      .where(eq(accountEntriesTable.date, today));

    const todayEntryIncome   = todayEntries
      .filter(e => e.type === "income")
      .reduce((s, e) => s + Number(e.amount), 0);
    const todayEntryExpenses = todayEntries
      .filter(e => e.type === "expense")
      .reduce((s, e) => s + Number(e.amount), 0);

    const monthEntries = await db
      .select({ type: accountEntriesTable.type, amount: accountEntriesTable.amount })
      .from(accountEntriesTable)
      .where(like(accountEntriesTable.date, `${currentMonth}%`));

    const monthEntryIncome   = monthEntries
      .filter(e => e.type === "income")
      .reduce((s, e) => s + Number(e.amount), 0);
    const monthEntryExpenses = monthEntries
      .filter(e => e.type === "expense")
      .reduce((s, e) => s + Number(e.amount), 0);

    // ── TASK 7: Salary expenses included in monthly expenses ────────────────
    const monthlySalaries = await db
      .select({ amount: salariesTable.amount, status: salariesTable.status })
      .from(salariesTable)
      .where(like(salariesTable.month, `${currentMonth}%`));

    const salaryExpenses = monthlySalaries
      .filter(s => s.status === "paid")
      .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

    // ── Totals ──────────────────────────────────────────────────────────────
    const todayIncome     = todayFeeIncome + todayEntryIncome;
    const todayExpenses   = todayEntryExpenses;
    const monthlyIncome   = monthFeeIncome + monthEntryIncome;
    const monthlyExpenses = monthEntryExpenses + salaryExpenses; // ← salaries included
    const netProfit       = monthlyIncome - monthlyExpenses;

    res.json({
      totalStudents:    Number(totalStudents),
      activeStudents:   Number(activeStudents),
      totalTeachers:    Number(totalTeachers),
      totalClasses:     Number(totalClasses),
      recentAdmissions: Number(recentAdmissions),
      defaulterCount:   Number(defaulterCount),
      pendingFees,
      todayIncome,
      todayExpenses,
      monthlyIncome,
      monthlyExpenses,
      netProfit,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
