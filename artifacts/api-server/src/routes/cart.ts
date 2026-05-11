import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  tablesTable,
  tableSessionsTable,
  sharedCartItemsTable,
  sessionParticipantsTable,
  menuItemsTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { verifySessionToken, type SessionTokenPayload } from "../lib/auth";

const router = Router();

interface SessionRequest extends Request {
  session?: SessionTokenPayload;
  tableQrToken?: string;
}

async function requireSession(req: SessionRequest, res: Response, next: NextFunction): Promise<void> {
  const headerToken = (req.headers["x-session-token"] as string | undefined) ?? null;
  const queryToken = (req.query["sessionToken"] as string | undefined) ?? null;
  const bodyToken = (req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>)["sessionToken"] : null) as string | null;
  const token = headerToken ?? bodyToken ?? queryToken;
  if (!token) {
    res.status(401).json({ error: "invalid_session", message: "Session token required" });
    return;
  }
  let payload: SessionTokenPayload;
  try {
    payload = verifySessionToken(token);
  } catch {
    res.status(401).json({ error: "invalid_session", message: "Session token хүчингүй" });
    return;
  }
  const [session] = await db
    .select()
    .from(tableSessionsTable)
    .where(eq(tableSessionsTable.id, payload.sid));
  if (!session || session.endedAt) {
    res.status(401).json({ error: "invalid_session", message: "Session дууссан байна" });
    return;
  }
  const tableToken = (req.params as { token?: string }).token;
  if (tableToken) {
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.qrToken, tableToken));
    if (!table || table.id !== payload.tid) {
      res.status(401).json({ error: "invalid_session", message: "Token таарахгүй байна" });
      return;
    }
    req.tableQrToken = tableToken;
  } else {
    const [table] = await db.select().from(tablesTable).where(eq(tablesTable.id, payload.tid));
    if (table) req.tableQrToken = table.qrToken;
  }
  req.session = payload;
  next();
}

async function broadcastCart(req: SessionRequest): Promise<void> {
  const io = req.app.get("io");
  if (!io || !req.tableQrToken || !req.session) return;
  const items = await db
    .select()
    .from(sharedCartItemsTable)
    .where(eq(sharedCartItemsTable.sessionId, req.session.sid))
    .orderBy(sharedCartItemsTable.createdAt);
  io.to(`session_${req.tableQrToken}`).emit("cart:updated", {
    sessionId: req.session.sid,
    items,
  });
}

router.get("/tables/:token/cart", requireSession, async (req: SessionRequest, res) => {
  try {
    const sessionId = req.session!.sid;
    const items = await db
      .select()
      .from(sharedCartItemsTable)
      .where(eq(sharedCartItemsTable.sessionId, sessionId))
      .orderBy(sharedCartItemsTable.createdAt);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessionParticipantsTable)
      .where(and(
        eq(sessionParticipantsTable.sessionId, sessionId),
        isNull(sessionParticipantsTable.leftAt),
      ));
    res.json({ items, participantCount: count ?? 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/tables/:token/cart/items", requireSession, async (req: SessionRequest, res) => {
  try {
    const sessionId = req.session!.sid;
    const customerId = req.session!.cid;
    const { menuItemId, quantity, notes } = req.body as {
      menuItemId: number;
      quantity?: number;
      notes?: string;
    };
    if (!menuItemId || !Number.isFinite(menuItemId)) {
      res.status(400).json({ error: "validation_error", message: "menuItemId шаардлагатай" });
      return;
    }
    const qty = Math.max(1, Math.min(99, quantity ?? 1));
    const [item] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, menuItemId));
    if (!item) {
      res.status(404).json({ error: "not_found", message: "Цэсний бүтээгдэхүүн олдсонгүй" });
      return;
    }
    if (!item.available) {
      res.status(400).json({ error: "not_available", message: "Бүтээгдэхүүн дууссан байна" });
      return;
    }
    const [existing] = await db
      .select()
      .from(sharedCartItemsTable)
      .where(and(
        eq(sharedCartItemsTable.sessionId, sessionId),
        eq(sharedCartItemsTable.menuItemId, menuItemId),
      ));
    if (existing) {
      await db
        .update(sharedCartItemsTable)
        .set({ quantity: existing.quantity + qty, updatedAt: new Date() })
        .where(eq(sharedCartItemsTable.id, existing.id));
    } else {
      await db.insert(sharedCartItemsTable).values({
        sessionId,
        menuItemId,
        menuItemName: item.name,
        unitPrice: item.price,
        quantity: qty,
        notes: notes ?? null,
        addedByCustomerId: customerId,
      });
    }
    await broadcastCart(req);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.patch("/tables/:token/cart/items/:itemId", requireSession, async (req: SessionRequest, res) => {
  try {
    const sessionId = req.session!.sid;
    const itemId = parseInt(req.params.itemId as string);
    const { quantity, notes } = req.body as { quantity?: number; notes?: string };
    if (!Number.isFinite(itemId)) {
      res.status(400).json({ error: "validation_error" });
      return;
    }
    const [existing] = await db
      .select()
      .from(sharedCartItemsTable)
      .where(and(
        eq(sharedCartItemsTable.id, itemId),
        eq(sharedCartItemsTable.sessionId, sessionId),
      ));
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (quantity !== undefined) {
      const qty = Math.max(0, Math.min(99, quantity));
      if (qty === 0) {
        await db.delete(sharedCartItemsTable).where(eq(sharedCartItemsTable.id, itemId));
        await broadcastCart(req);
        res.json({ ok: true, deleted: true });
        return;
      }
      updates.quantity = qty;
    }
    if (notes !== undefined) updates.notes = notes;
    await db.update(sharedCartItemsTable).set(updates).where(eq(sharedCartItemsTable.id, itemId));
    await broadcastCart(req);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.delete("/tables/:token/cart/items/:itemId", requireSession, async (req: SessionRequest, res) => {
  try {
    const sessionId = req.session!.sid;
    const itemId = parseInt(req.params.itemId as string);
    if (!Number.isFinite(itemId)) {
      res.status(400).json({ error: "validation_error" });
      return;
    }
    const result = await db
      .delete(sharedCartItemsTable)
      .where(and(
        eq(sharedCartItemsTable.id, itemId),
        eq(sharedCartItemsTable.sessionId, sessionId),
      ))
      .returning();
    if (result.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await broadcastCart(req);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.delete("/tables/:token/cart", requireSession, async (req: SessionRequest, res) => {
  try {
    const sessionId = req.session!.sid;
    await db.delete(sharedCartItemsTable).where(eq(sharedCartItemsTable.sessionId, sessionId));
    await broadcastCart(req);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

export default router;
