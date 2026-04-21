import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };
    if (!username || !password) {
      res.status(400).json({ error: "bad_request", message: "username and password required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
      return;
    }

    if ((user.role as string) !== "manager" && (user.role as string) !== "chef" && (user.role as string) !== "cashier") {
      res.status(403).json({ error: "forbidden", message: "Энэ эрх идэвхгүй болсон. Менежертэйгээ холбоо барина уу." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
      return;
    }

    const payload: JwtPayload = { id: user.id, username: user.username, name: user.name, role: user.role };
    const token = signToken(payload);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

router.get("/auth/me", requireAuth, (req, res) => {
  const user = (req as typeof req & { user: JwtPayload }).user;
  res.json(user);
});

export default router;
