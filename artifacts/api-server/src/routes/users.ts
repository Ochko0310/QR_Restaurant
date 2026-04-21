import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, staffShiftsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

const VALID_ROLES = ["manager", "chef", "cashier"] as const;
type Role = typeof VALID_ROLES[number];

router.get("/users", requireAuth, requireRole("manager"), async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.post("/users", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const { username, password, name, role } = req.body as {
      username: string;
      password: string;
      name: string;
      role: Role;
    };
    if (!username || !password || !name || !role) {
      res.status(400).json({ error: "validation_error", message: "Бүх талбар шаардлагатай" });
      return;
    }
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: "validation_error", message: "Буруу үүрэг" });
      return;
    }
    if (password.length < 4) {
      res.status(400).json({ error: "validation_error", message: "Нууц үг хамгийн багадаа 4 тэмдэгттэй байх ёстой" });
      return;
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    if (existing) {
      res.status(409).json({ error: "conflict", message: "Энэ нэвтрэх нэр аль хэдийн бүртгэлтэй байна" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ username, passwordHash, name, role })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.patch("/users/:id", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, role, password } = req.body as { name?: string; role?: Role; password?: string };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ error: "validation_error", message: "Буруу үүрэг" });
        return;
      }
      data.role = role;
    }
    if (password !== undefined) {
      if (password.length < 4) {
        res.status(400).json({ error: "validation_error", message: "Нууц үг хамгийн багадаа 4 тэмдэгттэй байх ёстой" });
        return;
      }
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: "validation_error", message: "Өөрчлөх зүйл алга" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      });
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.delete("/users/:id", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    // Prevent deleting self
    const me = (req as any).user;
    if (me?.id === id) {
      res.status(400).json({ error: "invalid_action", message: "Өөрийгөө устгах боломжгүй" });
      return;
    }

    // Remove shifts first (FK)
    await db.delete(staffShiftsTable).where(eq(staffShiftsTable.userId, id));
    const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
