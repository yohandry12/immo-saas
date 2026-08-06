import type { NextFunction, Request, Response } from "express";
import * as tenantService from "./service.js";

/** Rôle : renvoyer l'écran d'accueil du locataire connecté. */
export async function home(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(await tenantService.getTenantHome(req.user!.id));
  } catch (e) {
    return next(e);
  }
}

/** Rôle : renvoyer l'historique des paiements du locataire connecté. */
export async function payments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await tenantService.getTenantPayments(req.user!.id));
  } catch (e) {
    return next(e);
  }
}
