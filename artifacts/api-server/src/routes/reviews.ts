import { Router } from "express";
import { db } from "@workspace/db";
import { reviewsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createNotification } from "../lib/notifications";
import type { Server as SocketIOServer } from "socket.io";

const router = Router();

// Public: get reviews (anonymous - no name/phone)
router.get("/reviews", async (_req, res) => {
  try {
    const reviews = await db.select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      comment: reviewsTable.comment,
      createdAt: reviewsTable.createdAt,
    }).from(reviewsTable).orderBy(desc(reviewsTable.rating), desc(reviewsTable.createdAt));
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

// Staff: get reviews with personal info
router.get("/reviews/all", requireAuth, async (_req, res) => {
  try {
    const reviews = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.rating), desc(reviewsTable.createdAt));
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

    const io: SocketIOServer = req.app.get("io");
    await createNotification(io, {
      type: "review_new",
      title: "Шинэ сэтгэгдэл",
      message: `${name} — ${rating}★ "${comment.slice(0, 60)}${comment.length > 60 ? "…" : ""}"`,
      data: { reviewId: review.id, rating },
    });

    res.status(201).json({ id: review.id, rating: review.rating, comment: review.comment, createdAt: review.createdAt });
  } catch (err) {
    res.status(500).json({ error: "server_error", message: String(err) });
  }
});

export default router;
