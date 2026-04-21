import { Router } from "express";
import { db } from "@workspace/db";
import { menuCategoriesTable, menuItemsTable, inventoryItemsTable, orderItemsTable } from "@workspace/db";
import { eq, asc, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

router.get("/menu/categories", async (_req, res) => {
  try {
    const categories = await db.select().from(menuCategoriesTable).orderBy(asc(menuCategoriesTable.sortOrder));
    const items = await db.select().from(menuItemsTable).orderBy(asc(menuItemsTable.id));

    // Build nested structure: top-level categories with children
    const topLevel = categories.filter(c => !c.parentId);
    const result = topLevel.map((cat) => ({
      ...cat,
      items: items.filter((item) => item.categoryId === cat.id),
      children: categories
        .filter(child => child.parentId === cat.id)
        .map(child => ({
          ...child,
          items: items.filter(item => item.categoryId === child.id),
        })),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/menu/categories", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const { name, description, sortOrder, parentId } = req.body as { name: string; description?: string; sortOrder?: number; parentId?: number };
    const [cat] = await db.insert(menuCategoriesTable).values({ name, description, sortOrder: sortOrder ?? 0, parentId: parentId ?? null }).returning();
    res.status(201).json({ ...cat, items: [], children: [] });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/menu/categories/:catId", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const catId = parseInt(req.params.catId as string);

    // Check for child categories
    const children = await db.select({ id: menuCategoriesTable.id }).from(menuCategoriesTable).where(eq(menuCategoriesTable.parentId, catId));
    if (children.length > 0) {
      res.status(400).json({ error: "not_empty", message: "Дэд ангилалтай ангилалыг устгах боломжгүй. Эхлээд дэд ангилалуудыг устгана уу." });
      return;
    }

    // Check for menu items
    const items = await db.select({ id: menuItemsTable.id }).from(menuItemsTable).where(eq(menuItemsTable.categoryId, catId));
    if (items.length > 0) {
      res.status(400).json({ error: "not_empty", message: "Хоол бүтээгдэхүүнтэй ангилалыг устгах боломжгүй. Эхлээд хоолуудыг устгана уу." });
      return;
    }

    await db.delete(menuCategoriesTable).where(eq(menuCategoriesTable.id, catId));
    res.status(204).send();
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

router.post("/menu/items", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const { categoryId, name, description, price, imageUrl, modelUrl, available, preparationTime, inventoryItemId } = req.body as {
      categoryId: number;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
      modelUrl?: string;
      available?: boolean;
      preparationTime?: number;
      inventoryItemId?: number | null;
    };
    if (price < 0) {
      res.status(400).json({ error: "validation_error", message: "Үнэ 0-ээс бага байж болохгүй" });
      return;
    }
    const [item] = await db
      .insert(menuItemsTable)
      .values({ categoryId, name, description, price: String(price), imageUrl, modelUrl, available: available ?? true, preparationTime, inventoryItemId: inventoryItemId ?? null })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/menu/items/:itemId", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId as string);
    const updates = req.body as {
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      modelUrl?: string;
      available?: boolean;
      preparationTime?: number;
      inventoryItemId?: number | null;
    };

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.price !== undefined) {
      if (updates.price < 0) {
        res.status(400).json({ error: "validation_error", message: "Үнэ 0-ээс бага байж болохгүй" });
        return;
      }
      updateData.price = String(updates.price);
    }
    if (updates.imageUrl !== undefined) updateData.imageUrl = updates.imageUrl;
    if (updates.modelUrl !== undefined) updateData.modelUrl = updates.modelUrl;
    if (updates.available !== undefined) updateData.available = updates.available;
    if (updates.preparationTime !== undefined) updateData.preparationTime = updates.preparationTime;
    if (updates.inventoryItemId !== undefined) updateData.inventoryItemId = updates.inventoryItemId;

    const [item] = await db.update(menuItemsTable).set(updateData).where(eq(menuItemsTable.id, itemId)).returning();
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Back-sync name/image to linked inventory so the two views stay consistent
    if (item.inventoryItemId && (updates.name !== undefined || updates.imageUrl !== undefined)) {
      const invUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.name !== undefined) invUpdate.name = updates.name;
      if (updates.imageUrl !== undefined) invUpdate.imageUrl = updates.imageUrl;
      await db.update(inventoryItemsTable).set(invUpdate).where(eq(inventoryItemsTable.id, item.inventoryItemId));
    }

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/menu/items/:itemId", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId as string);

    // Detach from any historical order_items (menuItemName snapshot preserves the info).
    // If the column is still NOT NULL in the DB (pre-migration), this raw SQL will fail;
    // fall back to soft-disable so the user always gets a sensible result.
    try {
      await db.execute(sql`UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id = ${itemId}`);
      await db.delete(menuItemsTable).where(eq(menuItemsTable.id, itemId));
      res.status(204).send();
    } catch {
      await db.update(menuItemsTable).set({ available: false }).where(eq(menuItemsTable.id, itemId));
      res.status(204).send();
    }
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
