import jwt from "jsonwebtoken";
import { type Request, type Response, type NextFunction } from "express";

const jwtSecretFromEnv = process.env["JWT_SECRET"];
if (!jwtSecretFromEnv) {
  throw new Error("JWT_SECRET environment variable is required but was not provided.");
}
const JWT_SECRET: string = jwtSecretFromEnv;

export interface JwtPayload {
  id: number;
  username: string;
  name: string;
  role: "manager" | "chef" | "cashier";
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// Session tokens identify a specific guest dining session. They are issued
// during check-in and invalidated when the session's row gets `endedAt` set.
// `kind: "session"` disambiguates them from staff JWTs signed by the same key.
export interface SessionTokenPayload {
  kind: "session";
  sid: number;
  tid: number;
  cid: string;
}

export function signSessionToken(payload: Omit<SessionTokenPayload, "kind">): string {
  return jwt.sign({ ...payload, kind: "session" }, JWT_SECRET, { expiresIn: "8h" });
}

export function verifySessionToken(token: string): SessionTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as SessionTokenPayload;
  if (decoded.kind !== "session") throw new Error("wrong_token_kind");
  return decoded;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Missing token" });
    return;
  }
  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Invalid token" });
  }
}

// Populates req.user if a valid Bearer token is present, but lets the request
// through either way. Used on endpoints shared between guests and staff.
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(authHeader.slice(7));
      (req as Request & { user?: JwtPayload }).user = payload;
    } catch {
      // Ignore: fall through as unauthenticated guest.
    }
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user?: JwtPayload }).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient role" });
      return;
    }
    next();
  };
}
