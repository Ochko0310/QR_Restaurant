import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

// Public: get reviews (anonymous - no name/phone)
router.get("/reviews", async (_req, res) => {
  try {
    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
    }).from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: get reviews with personal info
router.get("/reviews/all", requireAuth, async (_req, res) => {
  try {
    const reviews = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Public: submit a review
router.post("/reviews", async (req, res) => {
  try {
    const { name, phone, rating, comment } = req.body as {
      name: string; phone: string; rating: number; comment: string;
    };
    if (!name || !phone || !rating || !comment) {
      res.status(400).json({ error: "validation_error", message: "Бүх талбарыг бөглөнө үү" });
      return;
    }
    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "validation_error", message: "Үнэлгээ 1-5 байх ёстой" });
      return;
    }
    const [review] = await db.insert(reviewsTable).values({ name, phone, rating, comment }).returning();
    res.status(201).json({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: delete a review
router.delete("/reviews/:id", requireAuth, requireRole("manager"), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string);
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
