import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router: ReturnType<typeof Router> = Router();

// Single-row settings table; we always use id=1.
const SETTINGS_ID = 1;

const defaults = {
  id: SETTINGS_ID,
  workingDaysPerMonth: 26,
  absentPenaltyFraction: "1.00",
  latePenaltyFraction:   "0.50",
  leavePenaltyFraction:  "0.00",
};

async function getOrCreate() {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ID));
  if (row) return row;
  await db.insert(settingsTable).values(defaults).onConflictDoNothing();
  const [created] = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ID));
  return created;
}

// GET /api/settings — any authenticated user can read (frontend needs it for calculations).
router.get("/", requireAuth, async (req, res) => {
  try {
    const row = await getOrCreate();
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Validate an incoming numeric field. Returns the cleaned value or null when
// not provided. Throws a string error if value is out of allowed range.
function validNum(v: unknown, min: number, max: number, integer = false): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("must be a number");
  if (integer && !Number.isInteger(n)) throw new Error("must be an integer");
  if (n < min || n > max) throw new Error(`must be between ${min} and ${max}`);
  return n;
}

// PUT /api/settings — admin only.
router.put("/", requireAuth, async (req, res) => {
  try {
    const user = (req as AuthReq).user;
    if (user.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const body = (req.body ?? {}) as Record<string, unknown>;
    let workingDays: number | null;
    let absentFrac:  number | null;
    let lateFrac:    number | null;
    let leaveFrac:   number | null;
    try {
      workingDays = validNum(body.workingDaysPerMonth,   1, 31, true);
      absentFrac  = validNum(body.absentPenaltyFraction, 0, 5);
      lateFrac    = validNum(body.latePenaltyFraction,   0, 5);
      leaveFrac   = validNum(body.leavePenaltyFraction,  0, 5);
    } catch (e: unknown) {
      res.status(400).json({ error: "Invalid input", message: (e as Error).message });
      return;
    }

    await getOrCreate(); // ensure row exists
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (workingDays !== null) patch.workingDaysPerMonth   = workingDays;
    if (absentFrac  !== null) patch.absentPenaltyFraction = absentFrac.toFixed(2);
    if (lateFrac    !== null) patch.latePenaltyFraction   = lateFrac.toFixed(2);
    if (leaveFrac   !== null) patch.leavePenaltyFraction  = leaveFrac.toFixed(2);

    await db.update(settingsTable).set(patch).where(eq(settingsTable.id, SETTINGS_ID));
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.id, SETTINGS_ID));
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
