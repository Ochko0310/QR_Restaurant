import { Router } from "express";
import { db } from "@workspace/db";
import { reservationsTable, tablesTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// Public: create a reservation
router.post("/reservations", async (req, res) => {
  try {
    const { guestName, guestPhone, partySize, reservationDate, notes } = req.body as {
      guestName: string;
      guestPhone: string;
      partySize: number;
      reservationDate: string;
      notes?: string;
    };

    if (!guestName || !guestPhone || !partySize || !reservationDate) {
      res.status(400).json({ error: "validation_error", message: "Нэр, утас, хүний тоо, огноо шаардлагатай" });
      return;
    }
    if (partySize <= 0 || partySize > 50) {
      res.status(400).json({ error: "validation_error", message: "Хүний тоо 1-50 хооронд байх ёстой" });
      return;
    }

    const date = new Date(reservationDate);
    if (date <= new Date()) {
      res.status(400).json({ error: "validation_error", message: "Ирээдүйн огноо сонгоно уу" });
      return;
    }

    // Auto-assign table based on capacity
    const tables = await db.select().from(tablesTable).where(gte(tablesTable.capacity, partySize));
    const tableId = tables.length > 0 ? tables[0]!.id : null;

    const [reservation] = await db.insert(reservationsTable).values({
      guestName,
      guestPhone,
      partySize,
      reservationDate: date,
      tableId,
      notes: notes ?? null,
    }).returning();

    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: get all reservations (with optional date filter)
router.get("/reservations", requireAuth, async (req, res) => {
  try {
    const { date } = req.query as { date?: string };

    let query = db.select().from(reservationsTable).$dynamic();

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query = query.where(and(gte(reservationsTable.reservationDate, start), lte(reservationsTable.reservationDate, end)));
    }

    const reservations = await query.orderBy(desc(reservationsTable.reservationDate));
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: update reservation status / assign table
router.patch("/reservations/:id", requireAuth, requireRole("manager", "waiter"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const updates = req.body as { status?: string; tableId?: number; notes?: string };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status !== undefined) {
      const valid = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"];
      if (!valid.includes(updates.status)) {
        res.status(400).json({ error: "validation_error", message: "Буруу статус" });
        return;
      }
      updateData.status = updates.status;

      // If seated, mark table as occupied
      if (updates.status === "seated" || updates.status === "confirmed") {
        const [reservation] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, id));
        if (reservation?.tableId && updates.status === "seated") {
          await db.update(tablesTable).set({ status: "occupied", occupiedSince: new Date() }).where(eq(tablesTable.id, reservation.tableId));
        }
        if (reservation?.tableId && updates.status === "confirmed") {
          await db.update(tablesTable).set({ status: "reserved" }).where(eq(tablesTable.id, reservation.tableId));
        }
      }
    }
    if (updates.tableId !== undefined) updateData.tableId = updates.tableId;
    if (updates.notes !== undefined) updateData.notes = updates.notes;

    const [reservation] = await db.update(reservationsTable).set(updateData).where(eq(reservationsTable.id, id)).returning();
    if (!reservation) { res.status(404).json({ error: "not_found" }); return; }
    res.json(reservation);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: delete reservation
router.delete("/reservations/:id", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(reservationsTable).where(eq(reservationsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
