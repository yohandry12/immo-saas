import type { NextFunction, Request, Response } from "express";
import { prisma } from "@immo/database";
import "./types.js";

export async function requireOrg(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentification requise" });
  }

  const orgId = req.headers["x-org-id"] as string | undefined;
  if (!orgId) {
    return res.status(400).json({ error: "Header X-Org-Id manquant" });
  }

  // Une seule requête : l'org existe-t-elle pour cet utilisateur,
  // et quel rôle y tient-il ?
  const org = await prisma.organization.findFirst({
    where: {
      id: orgId,
      OR: [
        { ownerId: req.user.id },
        { memberships: { some: { userId: req.user.id } } },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      // Le rôle de CET utilisateur dans CETTE org, dans la même requête.
      memberships: { where: { userId: req.user.id }, select: { role: true } },
    },
  });

  if (!org) {
    return res.status(403).json({ error: "Accès refusé à cette organisation" });
  }

  // Le propriétaire du portefeuille est toujours OWNER ;
  // sinon, le rôle vient de l'adhésion.
  req.orgRole =
    org.ownerId === req.user.id
      ? "OWNER"
      : (org.memberships[0]?.role ?? "MANAGER");
  req.orgId = org.id;
  next();
}
