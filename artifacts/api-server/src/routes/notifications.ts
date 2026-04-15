import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/notifications", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/notifications/read-all", requireAuth, async (_req, res) => {
  try {
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.read, false));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/notifications", requireAuth, async (_req, res) => {
  try {
    await db.delete(notificationsTable);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
