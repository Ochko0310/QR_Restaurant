import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";

// One-time cleanup: drop any legacy waiter users left over from old seeds.
// Cast to text so this works whether or not the 'waiter' enum value still exists.
async function purgeLegacyWaiters(): Promise<void> {
  try {
    const result = await db.execute(sql`DELETE FROM users WHERE role::text = 'waiter'`);
    const count = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Removed legacy waiter users");
  } catch (err) {
    logger.warn({ err }, "Legacy waiter cleanup skipped");
  }
}
void purgeLegacyWaiters();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Socket connected");

  socket.on("join", (room: string) => {
    socket.join(room);
    logger.info({ socketId: socket.id, room }, "Socket joined room");
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Socket disconnected");
  });
});

app.set("io", io);

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening with Socket.IO");
});
