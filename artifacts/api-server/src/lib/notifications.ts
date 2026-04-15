import type { Server as SocketIOServer } from "socket.io";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";

export type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

export async function createNotification(io: SocketIOServer | undefined, payload: NotificationPayload) {
  const [row] = await db.insert(notificationsTable).values({
    type: payload.type,
    title: payload.title,
    message: payload.message,
    data: payload.data ?? null,
  }).returning();
  if (io) {
    io.to("restaurant_1").emit("notification:new", row);
  }
  return row;
}
