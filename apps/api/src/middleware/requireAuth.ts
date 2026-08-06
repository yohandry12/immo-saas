import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@immo/database";
import { redis } from "../lib/redis.js";
import "./types.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as {
      sub: string;
      email?: string;
      role: Role;
      jti?: string;
      exp?: number;
    };

    // Un jeton déconnecté est mort AVANT son expiration :
    // la liste noire prime sur la date.
    // .catch(() => 0) : Redis indisponible → fail OPEN au MVP ;
    // en production, ce choix se discute (fail closed = plus strict).
    const dead = payload.jti
      ? await redis.exists(`token:blacklist:${payload.jti}`).catch(() => 0)
      : 0;
    if (dead) {
      return res.status(401).json({ error: "Session expirée" });
    }

    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    req.token = { jti: payload.jti, exp: payload.exp };
    next();
  } catch {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}
