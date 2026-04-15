import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryItemsTable, menuItemsTable, menuCategoriesTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// Name of the auto-created category that holds inventory-backed menu items
const DEFAULT_INVENTORY_CATEGORY = "Бараа";

async function ensureInventoryCategory(): Promise<number> {
  const [existing] = await db
    .select()
    .from(menuCategoriesTable)
    .where(eq(menuCategoriesTable.name, DEFAULT_INVENTORY_CATEGORY));
  if (existing) return existing.id;
  const [created] = await db
    .insert(menuCategoriesTable)
    .values({ name: DEFAULT_INVENTORY_CATEGORY, sortOrder: 99 })
    .returning();
  return created.id;
}

type InventoryRow = typeof inventoryItemsTable.$inferSelect;
type InventoryWithMenu = InventoryRow & { price: number; categoryId: number | null; menuItemId: number | null };

async function attachMenu(item: InventoryRow): Promise<InventoryWithMenu> {
  const [menu] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.inventoryItemId, item.id))
    .orderBy(asc(menuItemsTable.id));
  return {
    ...item,
    price: menu ? Number(menu.price) : 0,
    categoryId: menu?.categoryId ?? null,
    menuItemId: menu?.id ?? null,
  };
}

router.get("/inventory", requireAuth, requireRole("manager", "cashier"), async (_req, res) => {
  try {
    const items = await db.select().from(inventoryItemsTable).orderBy(desc(inventoryItemsTable.updatedAt));
    const enriched = await Promise.all(items.map(attachMenu));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/inventory", requireAuth, requireRole("manager", "cashier"), async (req, res) => {
  try {
    const { name, type, quantity, threshold, imageUrl, price, categoryId } = req.body as {
      name: string;
      type: string;
      quantity: number;
      threshold?: number;
      imageUrl?: string;
      price: number;
      categoryId?: number;
    };
    if (!name || !type) {
      res.status(400).json({ error: "validation_error", message: "Нэр, төрөл шаардлагатай" });
      return;
    }
    if (quantity == null || quantity < 0 || !Number.isInteger(quantity)) {
      res.status(400).json({ error: "validation_error", message: "Тоо ширхэг 0-ээс их бүхэл тоо байх ёстой" });
      return;
    }
    if (price == null || price < 0) {
      res.status(400).json({ error: "validation_error", message: "Үнэ 0-ээс бага байж болохгүй" });
      return;
    }

    const [item] = await db.insert(inventoryItemsTable).values({
      name, type, quantity, threshold: threshold ?? 5, imageUrl: imageUrl ?? null,
    }).returning();

    // Auto-create a linked menu item so customers can order it
    const targetCategoryId = categoryId ?? (await ensureInventoryCategory());
    await db.insert(menuItemsTable).values({
      categoryId: targetCategoryId,
      name,
      description: type,
      price: String(price),
      imageUrl: imageUrl ?? null,
      available: quantity > 0,
      inventoryItemId: item.id,
    });

    res.status(201).json(await attachMenu(item));
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/inventory/:id", requireAuth, requireRole("manager", "cashier"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const updates = req.body as {
      name?: string;
      type?: string;
      quantity?: number;
      threshold?: number;
      imageUrl?: string | null;
      price?: number;
      categoryId?: number;
    };
    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.quantity !== undefined) {
      if (updates.quantity < 0 || !Number.isInteger(updates.quantity)) {
        res.status(400).json({ error: "validation_error", message: "Тоо буруу байна" });
        return;
      }
      data.quantity = updates.quantity;
    }
    if (updates.threshold !== undefined) data.threshold = updates.threshold;
    if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl;

    const [item] = await db.update(inventoryItemsTable).set(data).where(eq(inventoryItemsTable.id, id)).returning();
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    // Sync linked menu item
    const menuUpdate: Record<string, unknown> = {};
    if (updates.name !== undefined) menuUpdate.name = updates.name;
    if (updates.type !== undefined) menuUpdate.description = updates.type;
    if (updates.imageUrl !== undefined) menuUpdate.imageUrl = updates.imageUrl;
    if (updates.price !== undefined) {
      if (updates.price < 0) {
        res.status(400).json({ error: "validation_error", message: "Үнэ 0-ээс бага байж болохгүй" });
        return;
      }
      menuUpdate.price = String(updates.price);
    }
    if (updates.categoryId !== undefined) menuUpdate.categoryId = updates.categoryId;
    if (updates.quantity !== undefined) menuUpdate.available = updates.quantity > 0;

    if (Object.keys(menuUpdate).length > 0) {
      await db.update(menuItemsTable).set(menuUpdate).where(eq(menuItemsTable.inventoryItemId, item.id));
    }

    res.json(await attachMenu(item));
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/inventory/:id", requireAuth, requireRole("manager", "cashier"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    // Delete linked menu items first (they have FK-like reference)
    await db.delete(menuItemsTable).where(eq(menuItemsTable.inventoryItemId, id));
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
