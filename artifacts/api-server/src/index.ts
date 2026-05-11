import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { eq, sql } from "drizzle-orm";
import { db, tablesTable } from "@workspace/db";
import app from "./app";
import { logger } from "./lib/logger";
import { verifyToken, type JwtPayload } from "./lib/auth";

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

interface SocketAuth {
  token?: string;
  tableToken?: string;
}

io.use(async (socket, next) => {
  const auth = socket.handshake.auth as SocketAuth;
  try {
    if (auth.token) {
      const payload = verifyToken(auth.token);
      (socket.data as { user?: JwtPayload }).user = payload;
      return next();
    }
    if (auth.tableToken) {
      const [table] = await db.select().from(tablesTable).where(eq(tablesTable.qrToken, auth.tableToken));
      if (!table) return next(new Error("invalid_table_token"));
      (socket.data as { tableToken?: string }).tableToken = auth.tableToken;
      return next();
    }
    return next(new Error("unauthenticated"));
  } catch {
    return next(new Error("unauthenticated"));
  }
});

io.on("connection", (socket) => {
  const user = (socket.data as { user?: JwtPayload }).user;
  const tableToken = (socket.data as { tableToken?: string }).tableToken;
  logger.info({ socketId: socket.id, role: user?.role, tableToken: tableToken ? "guest" : undefined }, "Socket connected");

  socket.on("join", (room: string) => {
    if (user && room.startsWith("restaurant_")) {
      socket.join(room);
      logger.info({ socketId: socket.id, room }, "Staff joined room");
      return;
    }
    if (tableToken && room === `session_${tableToken}`) {
      socket.join(room);
      logger.info({ socketId: socket.id, room }, "Guest joined room");
      return;
    }
    logger.warn({ socketId: socket.id, room }, "Socket join rejected");
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
