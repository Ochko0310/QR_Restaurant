import { Router } from "express";
import { db } from "@workspace/db";
import { bannersTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// Public: get active banners
router.get("/banners", async (_req, res) => {
  try {
    const banners = await db.select().from(bannersTable).where(eq(bannersTable.active, true)).orderBy(asc(bannersTable.sortOrder));
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: get all banners
router.get("/banners/all", requireAuth, async (_req, res) => {
  try {
    const banners = await db.select().from(bannersTable).orderBy(asc(bannersTable.sortOrder));
    res.json(banners);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/banners", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const { title, imageUrl, linkUrl, sortOrder, active } = req.body as {
      title?: string; imageUrl: string; linkUrl?: string; sortOrder?: number; active?: boolean;
    };
    const [banner] = await db.insert(bannersTable).values({
      title, imageUrl, linkUrl, sortOrder: sortOrder ?? 0, active: active ?? true,
    }).returning();
    res.status(201).json(banner);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/banners/:id", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const updates = req.body as { title?: string; imageUrl?: string; linkUrl?: string; sortOrder?: number; active?: boolean };
    const updateData: Record<string, unknown> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
    if (updates.linkUrl !== undefined) updateData.linkUrl = updates.linkUrl;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    if (updates.active !== undefined) updateData.active = updates.active;

    const [banner] = await db.update(bannersTable).set(updateData).where(eq(bannersTable.id, id)).returning();
    if (!banner) { res.status(404).json({ error: "not_found" }); return; }
    res.json(banner);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/banners/:id", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(bannersTable).where(eq(bannersTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
