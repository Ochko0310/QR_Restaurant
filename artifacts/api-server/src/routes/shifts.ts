import { Router } from "express";
import { db } from "@workspace/db";
import { staffShiftsTable, usersTable } from "@workspace/db";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

// Current user: check if I'm clocked in, and return my recent shifts
router.get("/shifts/me", requireAuth, async (req, res) => {
  try {
    const user = (req as unknown as { user: JwtPayload }).user;
    const [openShift] = await db
      .select()
      .from(staffShiftsTable)
      .where(and(eq(staffShiftsTable.userId, user.id), isNull(staffShiftsTable.clockOutAt)))
      .orderBy(desc(staffShiftsTable.clockInAt));
    const recent = await db
      .select()
      .from(staffShiftsTable)
      .where(eq(staffShiftsTable.userId, user.id))
      .orderBy(desc(staffShiftsTable.clockInAt))
      .limit(20);
    res.json({ openShift: openShift ?? null, recent });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Clock in
router.post("/shifts/clock-in", requireAuth, async (req, res) => {
  try {
    const user = (req as unknown as { user: JwtPayload }).user;
    const [existing] = await db
      .select()
      .from(staffShiftsTable)
      .where(and(eq(staffShiftsTable.userId, user.id), isNull(staffShiftsTable.clockOutAt)));
    if (existing) {
      res.status(400).json({ error: "already_clocked_in", message: "Та аль хэдийн ээлжинд орсон байна" });
      return;
    }
    const [row] = await db.insert(staffShiftsTable).values({ userId: user.id }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Clock out
router.post("/shifts/clock-out", requireAuth, async (req, res) => {
  try {
    const user = (req as unknown as { user: JwtPayload }).user;
    const { note } = (req.body ?? {}) as { note?: string };
    const [open] = await db
      .select()
      .from(staffShiftsTable)
      .where(and(eq(staffShiftsTable.userId, user.id), isNull(staffShiftsTable.clockOutAt)));
    if (!open) {
      res.status(400).json({ error: "no_open_shift", message: "Нээлттэй ээлж олдсонгүй" });
      return;
    }
    const [updated] = await db
      .update(staffShiftsTable)
      .set({ clockOutAt: new Date(), note: note ?? open.note ?? null })
      .where(eq(staffShiftsTable.id, open.id))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Manager: all shifts with optional date range + user filter
router.get("/shifts", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const { from, to, userId } = req.query as { from?: string; to?: string; userId?: string };
    const conditions = [];
    if (from) conditions.push(gte(staffShiftsTable.clockInAt, new Date(from)));
    if (to) conditions.push(lte(staffShiftsTable.clockInAt, new Date(to)));
    if (userId) conditions.push(eq(staffShiftsTable.userId, parseInt(userId)));
    const query = db
      .select({
        id: staffShiftsTable.id,
        userId: staffShiftsTable.userId,
        clockInAt: staffShiftsTable.clockInAt,
        clockOutAt: staffShiftsTable.clockOutAt,
        note: staffShiftsTable.note,
        userName: usersTable.name,
        userRole: usersTable.role,
      })
      .from(staffShiftsTable)
      .leftJoin(usersTable, eq(usersTable.id, staffShiftsTable.userId))
      .$dynamic();
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(staffShiftsTable.clockInAt))
      : await query.orderBy(desc(staffShiftsTable.clockInAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
