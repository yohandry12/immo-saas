import type { NextFunction, Request, Response } from "express";
import type { Role } from "@immo/database";

// Factory : requireRole('TENANT') RENVOIE un middleware.
// Même pattern que swagger-ui ou cors : fonction qui fabrique fonction.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentification requise" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Action réservée à un autre rôle" });
    }
    next();
  };
}
