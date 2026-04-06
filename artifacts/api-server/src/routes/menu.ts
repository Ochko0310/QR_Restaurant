import { Router } from "express";
import { db } from "@workspace/db";
import { menuCategoriesTable, menuItemsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/menu/categories", async (_req, res) => {
  try {
    const categories = await db.select().from(menuCategoriesTable).orderBy(asc(menuCategoriesTable.sortOrder));
    const items = await db.select().from(menuItemsTable).orderBy(asc(menuItemsTable.id));

    const result = categories.map((cat) => ({
      ...cat,
      items: items.filter((item) => item.categoryId === cat.id),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/menu/categories", requireAuth, async (req, res) => {
  try {
    const { name, description, sortOrder } = req.body as { name: string; description?: string; sortOrder?: number };
    const [cat] = await db.insert(menuCategoriesTable).values({ name, description, sortOrder: sortOrder ?? 0 }).returning();
    res.status(201).json({ ...cat, items: [] });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/menu/items", async (_req, res) => {
  try {
    const items = await db.select().from(menuItemsTable).orderBy(asc(menuItemsTable.id));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/menu/items", requireAuth, async (req, res) => {
  try {
    const { categoryId, name, description, price, imageUrl, modelUrl, available, preparationTime } = req.body as {
      categoryId: number;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
      modelUrl?: string;
      available?: boolean;
      preparationTime?: number;
    };
    const [item] = await db
      .insert(menuItemsTable)
      .values({ categoryId, name, description, price: String(price), imageUrl, modelUrl, available: available ?? true, preparationTime })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/menu/items/:itemId", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId!);
    const updates = req.body as {
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      modelUrl?: string;
      available?: boolean;
      preparationTime?: number;
    };

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.price !== undefined) updateData.price = String(updates.price);
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
    if (updates.modelUrl !== undefined) updateData.modelUrl = updates.modelUrl;
    if (updates.available !== undefined) updateData.available = updates.available;
    if (updates.preparationTime !== undefined) updateData.preparationTime = updates.preparationTime;

    const [item] = await db.update(menuItemsTable).set(updateData).where(eq(menuItemsTable.id, itemId)).returning();
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/menu/items/:itemId", requireAuth, async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId!);
    await db.delete(menuItemsTable).where(eq(menuItemsTable.id, itemId));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
