import { Router } from "express";
import { db } from "@workspace/db";
import { accountEntriesTable, feesTable, studentsTable } from "@workspace/db";
import { eq, and, like, sql, isNotNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// Helper: load paid fees as virtual income entries
async function loadFeeIncome(month?: string) {
  const rows = await db
    .select({
      id:        feesTable.id,
      amount:    feesTable.paidAmount,
      date:      feesTable.paidDate,
      studentId: feesTable.studentId,
      feeMonth:  feesTable.month,
      studentName: studentsTable.name,
    })
    .from(feesTable)
    .leftJoin(studentsTable, eq(feesTable.studentId, studentsTable.id))
    .where(isNotNull(feesTable.paidDate));
  return rows
    .filter(r => r.date && (!month || r.date.startsWith(month)))
    .map(r => ({
      id: -r.id, // negative id to avoid clashing with accountEntries ids
      type: "income" as const,
      category: "Fee Income",
      description: `Fee payment — ${r.studentName ?? "Student"} (${r.feeMonth})`,
      amount: Number(r.amount ?? 0),
      date: r.date as string,
      source: "fee" as const,
    }));
}

// GET /api/accounts/income
router.get("/income", requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const conditions = [eq(accountEntriesTable.type, "income")];
    if (month) conditions.push(like(accountEntriesTable.date, `${month}%`));
    const entries = await db.select().from(accountEntriesTable).where(and(...conditions));
    const manual = entries.map(e => ({ ...e, amount: Number(e.amount), source: "manual" as const }));
    const feeIncome = await loadFeeIncome(month ? String(month) : undefined);
    const merged = [...manual, ...feeIncome].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    res.json(merged);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/accounts/income
router.post("/income", requireAuth, async (req, res) => {
  try {
    const [entry] = await db.insert(accountEntriesTable).values({ ...req.body, type: "income" }).returning();
    res.status(201).json({ ...entry, amount: Number(entry.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/accounts/expenses
router.get("/expenses", requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const conditions = [eq(accountEntriesTable.type, "expense")];
    if (month) conditions.push(like(accountEntriesTable.date, `${month}%`));
    const entries = await db.select().from(accountEntriesTable).where(and(...conditions));
    res.json(entries.map(e => ({ ...e, amount: Number(e.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/accounts/expenses
router.post("/expenses", requireAuth, async (req, res) => {
  try {
    const [entry] = await db.insert(accountEntriesTable).values({ ...req.body, type: "expense" }).returning();
    res.status(201).json({ ...entry, amount: Number(entry.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/accounts/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [entry] = await db
      .update(accountEntriesTable)
      .set({ amount: req.body.amount, category: req.body.category, description: req.body.description, date: req.body.date })
      .where(eq(accountEntriesTable.id, id))
      .returning();
    if (!entry) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...entry, amount: Number(entry.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/accounts/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(accountEntriesTable).where(eq(accountEntriesTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/accounts/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const incomeConditions = [eq(accountEntriesTable.type, "income")];
    const expenseConditions = [eq(accountEntriesTable.type, "expense")];
    if (month) {
      incomeConditions.push(like(accountEntriesTable.date, `${month}%`));
      expenseConditions.push(like(accountEntriesTable.date, `${month}%`));
    }

    const [income] = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(...incomeConditions));
    const [expense] = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(...expenseConditions));

    // Include paid fees as income too
    const feeRows = await loadFeeIncome(month ? String(month) : undefined);
    const feeTotal = feeRows.reduce((s, r) => s + r.amount, 0);

    const totalIncome = Number(income?.total ?? 0) + feeTotal;
    const totalExpenses = Number(expense?.total ?? 0);
    res.json({ totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, month: month ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
