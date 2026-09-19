import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { id: string; role: "customer" | "owner" | "operator" | "admin" };
export type AuthRequest = Request & { user?: AuthUser };

const secret = () => process.env.JWT_ACCESS_SECRET ?? "development-only-change-me";

export function signAccessToken(user: AuthUser) {
  return jwt.sign(user, secret(), { expiresIn: "7d", issuer: "rentbuild-india" });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, secret(), { issuer: "rentbuild-india" }) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

export const requireRoles = (...roles: AuthUser["role"][]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
