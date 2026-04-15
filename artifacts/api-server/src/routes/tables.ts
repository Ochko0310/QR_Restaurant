import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { tablesTable, tableSessionsTable, customersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

router.get("/tables", requireAuth, async (_req, res) => {
  try {
    const tables = await db.select().from(tablesTable).orderBy(tablesTable.number);
    res.json(tables);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/tables", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const { number, name, capacity } = req.body as { number: number; name: string; capacity: number };
    if (!number || !name || !capacity || capacity <= 0) {
      res.status(400).json({ error: "validation_error", message: "Ширээний дугаар, нэр, багтаамж (>0) шаардлагатай" });
      return;
    }
    const qrToken = uuidv4();
    const [table] = await db.insert(tablesTable).values({ number, name, capacity, qrToken }).returning();
    res.status(201).json(table);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/tables/:tableId", requireAuth, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId as string);
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

router.patch("/tables/:tableId", requireAuth, requireRole("manager", "waiter"), async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId as string);
    const { name, capacity, status } = req.body as { name?: string; capacity?: number; status?: string };
    const validStatuses = ["available", "occupied", "reserved"];
    if (status !== undefined && !validStatuses.includes(status)) {
      res.status(400).json({ error: "validation_error", message: "Статус: available, occupied, reserved" });
      return;
    }
    if (capacity !== undefined && capacity <= 0) {
      res.status(400).json({ error: "validation_error", message: "Багтаамж 0-ээс их байх ёстой" });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (capacity !== undefined) updates.capacity = capacity;
    if (status !== undefined) {
      updates.status = status;
      if (status === "occupied") updates.occupiedSince = new Date();
      if (status === "available") {
        updates.occupiedSince = null;
        // Rotate qr token so any photographed copy becomes useless
        updates.qrToken = uuidv4();
      }
    }
    const [table] = await db.update(tablesTable).set(updates).where(eq(tablesTable.id, tableId)).returning();
    if (!table) { res.status(404).json({ error: "not_found" }); return; }

    if (status === "occupied") {
      // Close any stale open sessions, then start a fresh one waiting for check-in
      await db
        .update(tableSessionsTable)
        .set({ endedAt: new Date() })
        .where(and(eq(tableSessionsTable.tableId, tableId), isNull(tableSessionsTable.endedAt)));
      await db.insert(tableSessionsTable).values({ tableId });
    } else if (status === "available") {
      await db
        .update(tableSessionsTable)
        .set({ endedAt: new Date() })
        .where(and(eq(tableSessionsTable.tableId, tableId), isNull(tableSessionsTable.endedAt)));
    }

    res.json(table);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/tables/:tableId", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId as string);
    // Check for active orders before deleting
    const { ordersTable } = await import("@workspace/db");
    const { and, inArray } = await import("drizzle-orm");
    const activeOrders = await db.select({ id: ordersTable.id }).from(ordersTable)
      .where(and(eq(ordersTable.tableId, tableId), inArray(ordersTable.status, ["pending", "confirmed", "preparing", "ready", "served"])));
    if (activeOrders.length > 0) {
      res.status(400).json({ error: "not_empty", message: "Идэвхтэй захиалгатай ширээг устгах боломжгүй" });
      return;
    }
    await db.delete(tablesTable).where(eq(tablesTable.id, tableId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/tables/:tableId/qr", requireAuth, async (req, res) => {
  try {
    const tableId = parseInt(req.params.tableId as string);
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, tableId));
    if (!table) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;
    const protocol = (req.headers["x-forwarded-proto"] as string) || "http";
    const host = forwardedHost || req.headers.host || "";
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

router.post("/tables/:token/checkin", async (req, res) => {
  try {
    const { token } = req.params as { token: string };
    const { customerId } = req.body as { customerId?: string };

    if (!customerId) {
      res.status(400).json({ error: "bad_request", message: "customerId required" });
      return;
    }

    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, customerId));
    if (!customer) {
      res.status(404).json({ error: "customer_not_found", message: "Зочны бүртгэл олдсонгүй" });
      return;
    }

    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.qrToken, token));
    if (!table) {
      res.status(401).json({ error: "invalid_session", message: "QR код хүчингүй" });
      return;
    }

    if (table.status !== "occupied") {
      res.status(403).json({ error: "table_not_active", message: "Ширээ идэвхжээгүй байна. Үйлчлэгчид хандана уу." });
      return;
    }

    const [openSession] = await db
      .select()
      .from(tableSessionsTable)
      .where(and(eq(tableSessionsTable.tableId, table.id), isNull(tableSessionsTable.endedAt)));

    if (!openSession) {
      res.status(403).json({ error: "no_session", message: "Идэвхтэй session байхгүй байна" });
      return;
    }

    if (openSession.customerId && openSession.customerId !== customerId) {
      res.status(403).json({ error: "session_taken", message: "Энэ ширээний session өөр зочинд холбогдсон байна" });
      return;
    }

    if (!openSession.customerId) {
      await db
        .update(tableSessionsTable)
        .set({ customerId, checkedInAt: new Date() })
        .where(eq(tableSessionsTable.id, openSession.id));
    }

    res.json({
      sessionId: openSession.id,
      tableId: table.id,
      tableName: table.name,
      checkedIn: true,
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
      tableStatus: table.status,
      valid: true,
    });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
