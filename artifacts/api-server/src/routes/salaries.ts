import { Router } from "express";
import { db } from "@workspace/db";
import { salariesTable, staffTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: { id: number; role: string } };

const router = Router();

// GET /api/salaries — list all (admin only)
router.get("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const rows = await db.select().from(salariesTable).orderBy(desc(salariesTable.createdAt));
    const staffList = await db.select({ id: staffTable.id, name: staffTable.name }).from(staffTable);
    const staffMap = Object.fromEntries(staffList.map(s => [s.id, s.name]));

    res.json(rows.map(r => ({
      ...r,
      amount: Number(r.amount),
      staffName: staffMap[r.staffId] ?? "—",
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/salaries/:staffId/history — salary history for a staff member
router.get("/:staffId/history", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const rows = await db
      .select()
      .from(salariesTable)
      .where(eq(salariesTable.staffId, Number(req.params.staffId)))
      .orderBy(desc(salariesTable.createdAt));

    res.json(rows.map(r => ({ ...r, amount: Number(r.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/salaries — create salary record (admin only)
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const { staffId, amount, month, status, paidDate } = req.body;
    if (!staffId || !amount || !month) {
      res.status(400).json({ error: "staffId, amount, and month are required" });
      return;
    }

    const [row] = await db.insert(salariesTable).values({
      staffId: Number(staffId),
      amount: String(amount),
      month,
      status: status ?? "unpaid",
      paidDate: paidDate ?? null,
    }).returning();

    const [staff] = await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, Number(staffId)));

    res.status(201).json({ ...row, amount: Number(row.amount), staffName: staff?.name ?? "—" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/salaries/:id — update salary / mark as paid (admin only)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const [existing] = await db.select().from(salariesTable).where(eq(salariesTable.id, Number(req.params.id)));
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    const { amount, month, status, paidDate } = req.body;

    const [updated] = await db
      .update(salariesTable)
      .set({
        amount:   amount   !== undefined ? String(amount) : existing.amount,
        month:    month    !== undefined ? month          : existing.month,
        status:   status   !== undefined ? status         : existing.status,
        paidDate: paidDate !== undefined ? paidDate       : existing.paidDate,
      })
      .where(eq(salariesTable.id, Number(req.params.id)))
      .returning();

    res.json({ ...updated, amount: Number(updated.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/salaries/:id (admin only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const [existing] = await db.select().from(salariesTable).where(eq(salariesTable.id, Number(req.params.id)));
    if (!existing) { res.status(404).json({ error: "Record not found" }); return; }

    await db.delete(salariesTable).where(eq(salariesTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
