import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const { cursor, limit } = req.query as { cursor?: string; limit?: string };

    const parsedLimit = Number(limit);
    const effectiveLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.trunc(parsedLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const conditions = [];
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (Number.isNaN(cursorDate.getTime())) {
        res.status(400).json({ error: "validation_error", message: "Invalid cursor" });
        return;
      }
      conditions.push(lt(notificationsTable.createdAt, cursorDate));
    }

    const base = db.select().from(notificationsTable);
    const query = conditions.length > 0 ? base.where(and(...conditions)) : base;
    const rows = await query
      .orderBy(desc(notificationsTable.createdAt))
      .limit(effectiveLimit + 1);

    const hasMore = rows.length > effectiveLimit;
    const items = hasMore ? rows.slice(0, effectiveLimit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null;

    res.json({ items, nextCursor });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/notifications/read-all", requireAuth, async (_req, res) => {
  try {
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.read, false));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.delete("/notifications", requireAuth, requireRole("manager"), async (_req, res) => {
  try {
    await db.delete(notificationsTable);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
