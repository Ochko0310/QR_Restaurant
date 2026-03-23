import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { tablesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/tables", requireAuth, async (_req, res) => {
  try {
    const tables = await db.select().from(tablesTable).orderBy(tablesTable.number);
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/tables", requireAuth, async (req, res) => {
  try {
    const { number, name, capacity } = req.body as { number: number; name: string; capacity: number };
    const qrToken = uuidv4();
    const [table] = await db.insert(tablesTable).values({ number, name, capacity, qrToken }).returning();
    res.status(201).json(table);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/tables/:tableId", requireAuth, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId!);
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, tableId));
    if (!table) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/tables/:tableId", requireAuth, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId!);
    const { name, capacity, status } = req.body as { name?: string; capacity?: number; status?: string };
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (capacity !== undefined) updates.capacity = capacity;
    if (status !== undefined) updates.status = status;
    const [table] = await db.update(tablesTable).set(updates).where(eq(tablesTable.id, tableId)).returning();
    if (!table) { res.status(404).json({ error: "not_found" }); return; }
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/tables/:tableId", requireAuth, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId!);
    await db.delete(tablesTable).where(eq(tablesTable.id, tableId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/tables/:tableId/qr", requireAuth, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId!);
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, tableId));
    if (!table) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const host = req.headers.host ?? "";
    const protocol = req.headers["x-forwarded-proto"] ?? "http";
    const url = `${protocol}://${host}/menu?t=${table.qrToken}`;
    res.json({
      tableId: table.id,
      tableName: table.name,
      token: table.qrToken,
      url,
    });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/session/validate", async (req, res) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(401).json({ error: "invalid_session", message: "Missing token" });
      return;
    }
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.qrToken, token));
    if (!table) {
      res.status(401).json({ error: "invalid_session", message: "Invalid session token" });
      return;
    }
    res.json({
      tableId: table.id,
      tableName: table.name,
      tableNumber: table.number,
      valid: true,
    });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
