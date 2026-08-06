import type { NextFunction, Request, Response } from "express";
import { InviteManagerSchema } from "@immo/shared";
import * as orgService from "./service.js";

/**
 * Rôle : créer le compte agent + l'adhésion MANAGER. Route OWNER-only :
 * un agent ne peut pas inviter d'autres agents dans le portefeuille d'autrui.
 */
export async function inviteManager(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const parsed = InviteManagerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    return res
      .status(201)
      .json(await orgService.inviteManager(req.orgId!, parsed.data));
  } catch (e) {
    if (e instanceof orgService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}
// controller
export async function listMembers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await orgService.listMembers(req.orgId!));
  } catch (e) {
    return next(e);
  }
}

export async function revokeMember(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    await orgService.revokeMember(req.orgId!, req.user!.id, req.params.userId);
    return res.status(204).send();
  } catch (e) {
    if (e instanceof orgService.NotFoundError)
      return res.status(404).json({ error: e.message });
    if (e instanceof orgService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}
