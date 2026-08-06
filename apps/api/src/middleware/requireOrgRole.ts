import type { NextFunction, Request, Response } from "express";
import type { Role } from "@immo/database";

// À placer APRÈS requireOrg : lit le rôle par-org posé par ce dernier.
export function requireOrgRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.orgRole || !roles.includes(req.orgRole)) {
      return res
        .status(403)
        .json({ error: "Action réservée au propriétaire du portefeuille" });
    }
    next();
  };
}
