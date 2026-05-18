import { Router } from "express";
import { db } from "@workspace/db";
import { examsTable, examResultsTable, classesTable, studentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

// GET /api/exams — students only see exams for their class
router.get("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;

    let classIdFilter: number | null = null;
    if (reqUser.role === "student") {
      const [student] = await db
        .select({ classId: studentsTable.classId })
        .from(studentsTable)
        .where(eq(studentsTable.username, String(reqUser.username)));
      if (!student) { res.json([]); return; }
      classIdFilter = student.classId;
    }

    const query = db
      .select({
        id: examsTable.id,
        name: examsTable.name,
        classId: examsTable.classId,
        className: classesTable.name,
        subject: examsTable.subject,
        examDate: examsTable.examDate,
        totalMarks: examsTable.totalMarks,
        passingMarks: examsTable.passingMarks,
        createdAt: examsTable.createdAt,
      })
      .from(examsTable)
      .leftJoin(classesTable, eq(examsTable.classId, classesTable.id));

    const exams = classIdFilter
      ? await query.where(eq(examsTable.classId, classIdFilter))
      : await query;

    res.json(exams.map(e => ({ ...e, totalMarks: Number(e.totalMarks), passingMarks: Number(e.passingMarks) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/exams — admin/teacher only
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const [exam] = await db.insert(examsTable).values(req.body).returning();
    res.status(201).json({ ...exam, totalMarks: Number(exam.totalMarks), passingMarks: Number(exam.passingMarks) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/exams/:id/results — students only see their own result
router.get("/:id/results", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;

    if (reqUser.role === "student") {
      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.username, String(reqUser.username)));
      if (!student) { res.json([]); return; }

      const results = await db
        .select({
          id: examResultsTable.id,
          examId: examResultsTable.examId,
          studentId: examResultsTable.studentId,
          studentName: studentsTable.name,
          marksObtained: examResultsTable.marksObtained,
          grade: examResultsTable.grade,
          position: examResultsTable.position,
          remarks: examResultsTable.remarks,
          createdAt: examResultsTable.createdAt,
        })
        .from(examResultsTable)
        .leftJoin(studentsTable, eq(examResultsTable.studentId, studentsTable.id))
        .where(and(
          eq(examResultsTable.examId, Number(req.params.id)),
          eq(examResultsTable.studentId, student.id)
        ));

      res.json(results.map(r => ({ ...r, marksObtained: Number(r.marksObtained) })));
      return;
    }

    // Admin / teacher — all results
    const results = await db
      .select({
        id: examResultsTable.id,
        examId: examResultsTable.examId,
        studentId: examResultsTable.studentId,
        studentName: studentsTable.name,
        marksObtained: examResultsTable.marksObtained,
        grade: examResultsTable.grade,
        position: examResultsTable.position,
        remarks: examResultsTable.remarks,
        createdAt: examResultsTable.createdAt,
      })
      .from(examResultsTable)
      .leftJoin(studentsTable, eq(examResultsTable.studentId, studentsTable.id))
      .where(eq(examResultsTable.examId, Number(req.params.id)));

    res.json(results.map(r => ({ ...r, marksObtained: Number(r.marksObtained) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/exams/:id/results — admin/teacher only
router.post("/:id/results", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const [result] = await db
      .insert(examResultsTable)
      .values({ ...req.body, examId: Number(req.params.id) })
      .returning();
    res.status(201).json({ ...result, marksObtained: Number(result.marksObtained) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/exams/:id/results/:resultId — admin only
router.delete("/:id/results/:resultId", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    await db.delete(examResultsTable).where(eq(examResultsTable.id, Number(req.params.resultId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
