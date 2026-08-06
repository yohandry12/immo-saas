import type { NextFunction, Request, Response } from "express";
import {
  CreateChargeBillSchema,
  ListChargesQuerySchema,
  MarkAllocationPaidSchema,
} from "@immo/shared";
import * as chargeService from "./service.js";

/**
 * Rôle : valider le formulaire de facture, répartir, répondre 201
 * avec les parts calculées que le front affichera telles quelles.
 */
export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = CreateChargeBillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    const bill = await chargeService.createBill(req.orgId!, parsed.data);
    return res.status(201).json(bill);
  } catch (e) {
    if (e instanceof chargeService.NotFoundError)
      return res.status(404).json({ error: e.message });
    if (e instanceof chargeService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}

/**
 * Rôle : renvoyer les factures communes, avec qui doit quoi.
 */
export async function list(req: Request, res: Response, next: NextFunction) {
  const parsed = ListChargesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Filtres invalides", details: parsed.error.issues });
  }

  try {
    return res.json(await chargeService.listBills(req.orgId!, parsed.data));
  } catch (e) {
    return next(e);
  }
}

/**
 * Rôle : envoyer la facture et figer la répartition.
 */
export async function send(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    return res.json(await chargeService.sendBill(req.orgId!, req.params.id));
  } catch (e) {
    if (e instanceof chargeService.NotFoundError)
      return res.status(404).json({ error: e.message });
    if (e instanceof chargeService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}

/**
 * Rôle : enregistrer le règlement d'une part. Body facultatif
 * (méthode de paiement optionnelle) → « req.body ?? {} », réflexe déjà vu.
 */
export async function markPaid(
  req: Request<{ id: string; allocationId: string }>,
  res: Response,
  next: NextFunction,
) {
  const parsed = MarkAllocationPaidSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Données invalides", details: parsed.error.issues });
  }

  try {
    return res.json(
      await chargeService.markAllocationPaid(
        req.orgId!,
        req.params.id,
        req.params.allocationId,
        parsed.data,
        req.user!.id,
      ),
    );
  } catch (e) {
    if (e instanceof chargeService.NotFoundError)
      return res.status(404).json({ error: e.message });
    if (e instanceof chargeService.ConflictError)
      return res.status(409).json({ error: e.message });
    return next(e);
  }
}
