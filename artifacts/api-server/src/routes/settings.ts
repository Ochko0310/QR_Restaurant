import { Router } from "express";
import { db } from "@workspace/db";
import { restaurantSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// Public: get all settings
router.get("/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(restaurantSettingsTable);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: upsert a setting
router.put("/settings/:key", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const key = req.params.key as string;
    const { value } = req.body as { value: string };
    const [existing] = await db.select().from(restaurantSettingsTable).where(eq(restaurantSettingsTable.key, key));
    if (existing) {
      await db.update(restaurantSettingsTable).set({ value, updatedAt: new Date() }).where(eq(restaurantSettingsTable.key, key));
    } else {
      await db.insert(restaurantSettingsTable).values({ key, value });
    }
    res.json({ key, value });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
